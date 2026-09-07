import { useRef, useEffect } from "react";
import {
  computeBoundingBox,
  pointInBoundingBox,
  resizePoints,
  rotatePoints,
  calculateScaleFromCorner,
  getBboxCenter,
} from "../../../utils/geometry";
import { detectHandle, getCursorForHandle } from "../../../utils/handles";
import { isCoarsePointerEvent, COARSE_HANDLE_HIT_SCALE } from "../../../utils/pointerType";
import { calculateTextBbox, resizeTextBox, ensureTextBox, refreshTextBounds } from "../../../utils/textBbox";
import { logger } from "../../../utils/logger";

/**
 * Transform mode handler - move, resize, and rotate selected strokes
 * Only active when strokes are selected in select mode
 */
export function useTransformMode({
  canvasRef,
  canvasHelpers,
  viewport,
  isSelectMode,
  selectedStrokeIdsRef,
  allStrokesRef,
  operationManager,
  getCombinedBoundingBox,
  redrawCanvas,
  canEdit,
  userId,
  userRole,
  isOwner,
}) {
  const isMoving = useRef(false);
  const moveStartPoint = useRef(null);
  const moveStartPositions = useRef([]);
  const currentMoveOffset = useRef({ x: 0, y: 0 });

  const isResizing = useRef(false);
  const resizeHandle = useRef(null);
  const resizeStartPoints = useRef(new Map());
  const resizeStartCombinedBbox = useRef(null);

  const isRotating = useRef(false);
  const rotateStartAngle = useRef(null);
  const rotateStartPoints = useRef(new Map());

  const currentHoveredHandle = useRef(null);
  const canEditRef = useRef(canEdit);
  const userIdRef = useRef(userId);
  const userRoleRef = useRef(userRole);
  const isOwnerRef = useRef(isOwner);

  useEffect(() => {
    canEditRef.current = canEdit;
    userIdRef.current = userId;
    userRoleRef.current = userRole;
    isOwnerRef.current = isOwner;
  }, [canEdit, userId, userRole, isOwner]);

  // Check if user can transform a specific stroke
  const canTransformStroke = (stroke) => {
    if (!canEditRef.current) return false; // VIEWER cannot transform
    if (isOwnerRef.current || userRoleRef.current === 'ADMIN') return true; // Owner/ADMIN can transform anything
    if (userRoleRef.current === 'EDITOR') {
      // EDITOR can transform own strokes + orphaned strokes
      return !stroke.userId || stroke.userId === userIdRef.current;
    }
    return false; // Default deny
  };

  // Helper: Get selected strokes
  const getSelectedStrokes = () => {
    const strokes = [];
    selectedStrokeIdsRef.current.forEach((strokeId) => {
      const stroke = allStrokesRef.current.get(strokeId);
      if (stroke) {
        strokes.push(stroke);
      }
    });
    allStrokesRef.current.forEach(stroke => {
      if (stroke.type === 'text' && stroke.attachedTo && selectedStrokeIdsRef.current.has(stroke.attachedTo) && !selectedStrokeIdsRef.current.has(stroke.id)) strokes.push(stroke);
    });
    return strokes;
  };

  const handleMouseDown = (e) => {
    const isActive = canEditRef.current && isSelectMode && selectedStrokeIdsRef.current.size > 0;
    if (!isActive) {
      return { handled: false };
    }

    const clickPoint = canvasHelpers.getCanvasPoint(e);
    if (!clickPoint) return { handled: false };

    const combinedBbox = getCombinedBoundingBox();
    if (!combinedBbox) return { handled: false };

    // Defensive check: ensure all selected strokes can be transformed
    const selectedStrokes = getSelectedStrokes();
    const canTransformAll = selectedStrokes.every(stroke => canTransformStroke(stroke));
    if (!canTransformAll) {
      logger.log('⛔ Cannot transform - some selected strokes are not owned by user');
      return { handled: false };
    }

    // Check for handle clicks first (resize or rotate) — coarse pointers get a bigger grab zone.
    const handle = detectHandle(
      clickPoint,
      combinedBbox,
      viewport.getCurrentZoom(),
      isCoarsePointerEvent(e) ? COARSE_HANDLE_HIT_SCALE : 1
    );
    if (handle) {
      if (handle.type === "resize") {
        // Enter resize mode
        isResizing.current = true;
        resizeHandle.current = handle;

        // Store original state for undo and preview
        resizeStartPoints.current = new Map();
        resizeStartCombinedBbox.current = { ...combinedBbox };

        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          if (stroke.type === 'text') {
            ensureTextBox(stroke);
            // Store original text data
            resizeStartPoints.current.set(stroke.id, {
              x: stroke.x,
              y: stroke.y,
              fontSize: stroke.fontSize,
              config: structuredClone(stroke.config),
            });
          } else {
            // Store original stroke points
            resizeStartPoints.current.set(stroke.id, [...stroke.points]);
          }
        });

        return { handled: true, mode: "transform-resize" };
      } else if (handle.type === "rotate") {
        // Enter rotate mode
        isRotating.current = true;

        // Calculate initial angle using combined bbox center
        const center = getBboxCenter(combinedBbox);
        rotateStartAngle.current = Math.atan2(
          clickPoint.y - center.y,
          clickPoint.x - center.x
        );

        // Store original points
        rotateStartPoints.current = new Map();
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          if (stroke.type === 'text') {
            // Store original text position
            rotateStartPoints.current.set(stroke.id, {
              x: stroke.x,
              y: stroke.y
            });
          } else {
            // Store original stroke points
            rotateStartPoints.current.set(stroke.id, [...stroke.points]);
          }
        });

        return { handled: true, mode: "transform-rotate" };
      }
    }

    // Check if clicking inside bbox for move mode (no Ctrl key)
    if (!e.ctrlKey && pointInBoundingBox(clickPoint, combinedBbox, 5)) {
      // Enter move mode
      isMoving.current = true;
      moveStartPoint.current = clickPoint;

      // Store initial positions of all selected strokes
      moveStartPositions.current = [];
      const selectedStrokes = getSelectedStrokes();
      selectedStrokes.forEach((stroke) => {
        if (stroke.type === 'text') {
          // Store text position
          moveStartPositions.current.push({
            id: stroke.id,
            x: stroke.x,
            y: stroke.y,
            bbox: stroke.bbox,
          });
        } else {
          // Store stroke points
          moveStartPositions.current.push({
            id: stroke.id,
            points: [...stroke.points],
            bbox: stroke.bbox || computeBoundingBox(stroke.points),
          });
        }
      });

      return { handled: true, mode: "transform-move" };
    }

    return { handled: false };
  };

  const handleMouseMove = (e) => {
    const currentPoint = canvasHelpers.getCanvasPoint(e);
    if (!currentPoint) return { handled: false };

    // Handle move preview
    if (isMoving.current && moveStartPoint.current) {
      const deltaX = currentPoint.x - moveStartPoint.current.x;
      const deltaY = currentPoint.y - moveStartPoint.current.y;

      currentMoveOffset.current = { x: deltaX, y: deltaY };
      redrawCanvas();
      return { handled: true };
    }

    // Handle resize preview
    if (isResizing.current && resizeHandle.current) {
      const ctrlPressed = e.shiftKey;
      const originalCombinedBbox = resizeStartCombinedBbox.current;

      if (originalCombinedBbox) {
        const { scaleX, scaleY, anchorPoint } = calculateScaleFromCorner(
          originalCombinedBbox,
          currentPoint,
          resizeHandle.current.position,
          ctrlPressed
        );

        // Apply resize to all selected strokes (preview)
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          if (stroke.type === 'text') {
            const originalData = resizeStartPoints.current.get(stroke.id);
            if (originalData) {
              Object.assign(stroke, structuredClone(originalData));
              refreshTextBounds(stroke);
              resizeTextBox(stroke, scaleX, scaleY, anchorPoint);
            }
          } else {
            // Resize stroke preview
            const originalPoints = resizeStartPoints.current.get(stroke.id);
            if (originalPoints) {
              stroke.points = resizePoints(
                originalPoints,
                anchorPoint,
                scaleX,
                scaleY
              );
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        redrawCanvas();
      }
      return { handled: true };
    }

    // Handle rotate preview
    if (isRotating.current) {
      const combinedBbox = getCombinedBoundingBox();

      if (combinedBbox) {
        const center = getBboxCenter(combinedBbox);
        const currentAngle = Math.atan2(
          currentPoint.y - center.y,
          currentPoint.x - center.x
        );

        const angleDelta = currentAngle - rotateStartAngle.current;

        // Apply rotation to all selected strokes (preview)
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          if (stroke.type === 'text') {
            // Rotate text position preview
            const originalData = rotateStartPoints.current.get(stroke.id);
            if (originalData) {
              const dx = originalData.x - center.x;
              const dy = originalData.y - center.y;
              const cos = Math.cos(angleDelta);
              const sin = Math.sin(angleDelta);

              stroke.x = center.x + (dx * cos - dy * sin);
              stroke.y = center.y + (dx * sin + dy * cos);

              // Update bbox using accurate measurement
              stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
            }
          } else {
            // Rotate stroke preview
            const originalPoints = rotateStartPoints.current.get(stroke.id);
            if (originalPoints) {
              stroke.points = rotatePoints(originalPoints, center, angleDelta);
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        redrawCanvas();
      }
      return { handled: true };
    }

    // Update cursor based on hovered handle (when not transforming)
    if (selectedStrokeIdsRef.current.size > 0) {
      const combinedBbox = getCombinedBoundingBox();
      const hoveredHandle = combinedBbox
        ? detectHandle(currentPoint, combinedBbox, viewport.getCurrentZoom(), isCoarsePointerEvent(e) ? COARSE_HANDLE_HIT_SCALE : 1)
        : null;

      if (hoveredHandle !== currentHoveredHandle.current) {
        currentHoveredHandle.current = hoveredHandle;
        const canvas = canvasRef.current;
        if (canvas) {
          const cursor = hoveredHandle
            ? getCursorForHandle(hoveredHandle.type, hoveredHandle.position)
            : "default";
          canvas.style.cursor = cursor;
        }
      }
    }

    return { handled: false };
  };

  const handleMouseUp = (e) => {
    // Complete move operation
    if (isMoving.current) {
      if (moveStartPositions.current.length > 0 && currentMoveOffset.current) {
        const { x: deltaX, y: deltaY } = currentMoveOffset.current;
        const savedMoveStartPositions = [...moveStartPositions.current];

        // Reset move state BEFORE calling operation manager
        isMoving.current = false;
        moveStartPoint.current = null;
        moveStartPositions.current = [];
        currentMoveOffset.current = { x: 0, y: 0 };

        // Only apply move if there was actual movement
        if (deltaX !== 0 || deltaY !== 0) {
          const strokeIds = savedMoveStartPositions
            .map((pos) => pos.id)  // Use stored ID directly from Map storage
            .filter((id) => id);

          if (strokeIds.length > 0) {
            operationManager.moveStrokes(
              strokeIds,
              deltaX,
              deltaY,
              savedMoveStartPositions
            );
          }
        }
      } else {
        // Reset move state even if no movement
        isMoving.current = false;
        moveStartPoint.current = null;
        moveStartPositions.current = [];
        currentMoveOffset.current = { x: 0, y: 0 };
      }
      return { handled: true };
    }

    // Complete resize operation
    if (isResizing.current) {
      const currentPoint = canvasHelpers.getCanvasPoint(e);
      const ctrlPressed = e?.shiftKey || false;
      const originalCombinedBbox = resizeStartCombinedBbox.current;

      if (originalCombinedBbox && resizeHandle.current && currentPoint) {
        const { scaleX, scaleY, anchorPoint } = calculateScaleFromCorner(
          originalCombinedBbox,
          currentPoint,
          resizeHandle.current.position,
          ctrlPressed
        );

        // Restore original state before applying final operation
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          const originalData = resizeStartPoints.current.get(stroke.id);
          if (originalData) {
            if (stroke.type === 'text') {
              // Restore original text state
              stroke.x = originalData.x;
              stroke.y = originalData.y;
              stroke.fontSize = originalData.fontSize;
              stroke.config = structuredClone(originalData.config);

              // Restore bbox using accurate measurement
              stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
            } else {
              // Restore original stroke points
              stroke.points = [...originalData];
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        // Capture what the op/inverse need BEFORE the teardown clears the refs below.
        const handlePosition = resizeHandle.current.position;
        const originalBboxForOp = originalCombinedBbox; // pre-resize bbox for the edge-translate math
        const textOriginals = {};
        selectedStrokes.forEach((stroke) => {
          if (stroke.type === 'text') {
            const orig = resizeStartPoints.current.get(stroke.id);
            if (orig) textOriginals[stroke.id] = structuredClone(orig);
          }
        });

        // Reset resize state BEFORE calling operation manager
        isResizing.current = false;
        resizeHandle.current = null;
        resizeStartPoints.current.clear();
        resizeStartCombinedBbox.current = null;

        // Only create operation if there was actual resize
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          const strokeIds = selectedStrokes.map(s => s.id);

          if (strokeIds.length > 0) {
            operationManager.resizeStrokes(
              strokeIds,
              scaleX,
              scaleY,
              anchorPoint,
              handlePosition,
              textOriginals,
              originalBboxForOp
            );
          }
        }
      } else {
        // Reset resize state - restore original state
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          const originalData = resizeStartPoints.current.get(stroke.id);
          if (originalData) {
            if (stroke.type === 'text') {
              // Restore original text state
              stroke.x = originalData.x;
              stroke.y = originalData.y;
              stroke.fontSize = originalData.fontSize;
              stroke.config = structuredClone(originalData.config);

              // Restore bbox using accurate measurement
              stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
            } else {
              // Restore original stroke points
              stroke.points = [...originalData];
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        isResizing.current = false;
        resizeHandle.current = null;
        resizeStartPoints.current.clear();
        resizeStartCombinedBbox.current = null;
        redrawCanvas();
      }
      return { handled: true };
    }

    // Complete rotate operation
    if (isRotating.current) {
      const currentPoint = canvasHelpers.getCanvasPoint(e);
      const combinedBbox = getCombinedBoundingBox();

      if (combinedBbox && currentPoint) {
        const center = getBboxCenter(combinedBbox);
        const currentAngle = Math.atan2(
          currentPoint.y - center.y,
          currentPoint.x - center.x
        );

        const angleDelta = currentAngle - rotateStartAngle.current;

        // Restore original points before applying final operation
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          const originalPoints = rotateStartPoints.current.get(stroke.id);
          if (originalPoints) {
            if (stroke.type === 'text') {
              Object.assign(stroke, originalPoints);
              refreshTextBounds(stroke);
            } else {
              stroke.points = [...originalPoints];
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        // Reset rotate state BEFORE calling operation manager
        isRotating.current = false;
        const savedStartPoints = new Map(rotateStartPoints.current);
        rotateStartAngle.current = null;
        rotateStartPoints.current.clear();

        // Only create operation if there was actual rotation
        if (Math.abs(angleDelta) > 0.01) {
          const strokeIds = selectedStrokes.map(s => s.id);

          if (strokeIds.length > 0) {
            operationManager.rotateStrokes(
              strokeIds,
              angleDelta,
              center,
              savedStartPoints
            );
          }
        }
      } else {
        // Reset rotate state - restore original points
        const selectedStrokes = getSelectedStrokes();
        selectedStrokes.forEach((stroke) => {
          const originalPoints = rotateStartPoints.current.get(stroke.id);
          if (originalPoints) {
            if (stroke.type === 'text') {
              Object.assign(stroke, originalPoints);
              refreshTextBounds(stroke);
            } else {
              stroke.points = [...originalPoints];
              stroke.bbox = computeBoundingBox(stroke.points);
            }
          }
        });

        isRotating.current = false;
        rotateStartAngle.current = null;
        rotateStartPoints.current.clear();
        redrawCanvas();
      }
      return { handled: true };
    }

    return { handled: false };
  };

  // Abandon an in-progress transform WITHOUT committing, restoring pre-gesture geometry.
  // Mirrors the "no movement" reset branches in handleMouseUp — move is offset-only (no geometry
  // mutation), but resize/rotate mutate strokes in place each preview frame and must be restored
  // from their snapshot maps. Used when a 2nd finger lands mid-transform (→ pinch/pan).
  const cancel = () => {
    // Move: geometry was never touched — the renderer just drew at currentMoveOffset.
    if (isMoving.current) {
      isMoving.current = false;
      moveStartPoint.current = null;
      moveStartPositions.current = [];
      currentMoveOffset.current = { x: 0, y: 0 };
      redrawCanvas();
      return { handled: true };
    }

    // Resize: restore each stroke's exact pre-resize state from the snapshot.
    if (isResizing.current) {
      const selectedStrokes = getSelectedStrokes();
      selectedStrokes.forEach((stroke) => {
        const originalData = resizeStartPoints.current.get(stroke.id);
        if (!originalData) return;
        if (stroke.type === 'text') {
          stroke.x = originalData.x;
          stroke.y = originalData.y;
          stroke.fontSize = originalData.fontSize;
          stroke.config = structuredClone(originalData.config);
          stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
        } else {
          stroke.points = [...originalData];
          stroke.bbox = computeBoundingBox(stroke.points);
        }
      });
      isResizing.current = false;
      resizeHandle.current = null;
      resizeStartPoints.current.clear();
      resizeStartCombinedBbox.current = null;
      redrawCanvas();
      return { handled: true };
    }

    // Rotate: restore each stroke's exact pre-rotation state from the snapshot.
    if (isRotating.current) {
      const selectedStrokes = getSelectedStrokes();
      selectedStrokes.forEach((stroke) => {
        const originalPoints = rotateStartPoints.current.get(stroke.id);
        if (!originalPoints) return;
        if (stroke.type === 'text') {
          Object.assign(stroke, originalPoints);
          refreshTextBounds(stroke);
        } else {
          stroke.points = [...originalPoints];
          stroke.bbox = computeBoundingBox(stroke.points);
        }
      });
      isRotating.current = false;
      rotateStartAngle.current = null;
      rotateStartPoints.current.clear();
      redrawCanvas();
      return { handled: true };
    }

    return { handled: false };
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancel,
    // Export refs for renderer
    isMoving,
    isResizing,
    isRotating,
    currentMoveOffset,
  };
}
