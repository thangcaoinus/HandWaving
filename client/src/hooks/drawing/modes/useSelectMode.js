import { textContainsPoint } from '../../../utils/textBbox';
import { refreshImageBounds } from '../../../utils/imageBbox';
import { useRef, useEffect } from "react";
import { simplify } from "../../../utils/simplify";
import {
  computeBoundingBox,
  pointInBoundingBox,
  rectangleIntersectsBoundingBox,
  doesBboxIntersectPolygon,
  closeLassoPath,
  distanceBetweenPoints,
} from "../../../utils/geometry";
import { logger } from "../../../utils/logger";

/**
 * Selection mode handler - rectangle, lasso, and Ctrl+click selection
 * Handles brush types 3 (rectangle) and 4 (lasso)
 */
export function useSelectMode({
  canvasHelpers,
  isSelectMode,
  isLassoMode,
  allStrokesRef,
  selectionRectRef,
  addToSelection,
  removeFromSelection,
  clearSelection,
  isStrokeSelected,
  redrawCanvas,
  canEdit,
  userId,
  userRole,
  isOwner,
}) {
  const isSelecting = useRef(false);
  const isLassoing = useRef(false);
  const selectionStartPoint = useRef(null);
  const lassoPoints = useRef([]);
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

  // Lazily ensure any object has a bbox before a hit test. Images derive theirs from x/y/w/h
  // (computeBoundingBox(stroke.points) would be null for them); strokes fall back to their points.
  const ensureBbox = (stroke) => {
    if (stroke.bbox) return;
    if (stroke.type === 'image') refreshImageBounds(stroke);
    else stroke.bbox = computeBoundingBox(stroke.points);
  };

  // Check if user can select a specific stroke
  const canSelectStroke = (stroke) => {
    if (!canEditRef.current) return false; // VIEWER cannot select
    if (isOwnerRef.current || userRoleRef.current === 'ADMIN') return true; // Owner/ADMIN can select anything
    if (userRoleRef.current === 'EDITOR') {
      // EDITOR can select own strokes + orphaned strokes
      return !stroke.userId || stroke.userId === userIdRef.current;
    }
    return false; // Default deny
  };

  const handleMouseDown = (e) => {
    if (!canEditRef.current || !isSelectMode) {
      return { handled: false };
    }

    const clickPoint = canvasHelpers.getCanvasPoint(e);
    if (!clickPoint) return { handled: false };

    if (!e.ctrlKey) {
      const text = [...allStrokesRef.current.values()].reverse().find(s => s.type === 'text' && textContainsPoint(s, clickPoint));
      if (text && canSelectStroke(text)) {
        clearSelection();
        addToSelection(text.id);
        redrawCanvas();
        return { handled: true };
      }
    }

    // Handle Ctrl+click to select/deselect individual objects
    if (e.ctrlKey) {
      logger.log('🖱️ Ctrl+click selection - allStrokesRef has:', allStrokesRef.current.size, 'strokes');
      // Find which stroke was clicked (search from top-most)
      // Convert Map to Array for top-down iteration
      const strokesArray = Array.from(allStrokesRef.current.values());
      let clickedStroke = null;
      for (let i = strokesArray.length - 1; i >= 0; i--) {
        const stroke = strokesArray[i];
        ensureBbox(stroke);
        if (stroke.type === 'text' ? textContainsPoint(stroke, clickPoint) : pointInBoundingBox(clickPoint, stroke.bbox, 5)) {
          clickedStroke = stroke;
          logger.log('✅ Found clicked stroke at index:', i, 'id:', stroke.id);
          break;
        }
      }

      if (clickedStroke && clickedStroke.id) {
        // Check if user can select this stroke
        if (!canSelectStroke(clickedStroke)) {
          logger.log('⛔ Cannot select stroke - permission denied (not owner)');
          return { handled: true, mode: 'select-individual' };
        }
        // Toggle selection of the clicked stroke
        if (isStrokeSelected(clickedStroke.id)) {
          removeFromSelection(clickedStroke.id);
        } else {
          addToSelection(clickedStroke.id);
        }
        redrawCanvas();
        return { handled: true, mode: 'select-individual' };
      }
      // If Ctrl held but no stroke clicked, fall through to area selection (additive)
    }

    // Start area selection (rectangle or lasso)
    // Clear existing selection only if NOT holding Ctrl (additive selection)
    if (!e.ctrlKey) {
      clearSelection();
    }

    if (isLassoMode) {
      // Start lasso selection
      isLassoing.current = true;
      lassoPoints.current = [clickPoint];
    } else {
      // Start rectangle selection
      isSelecting.current = true;
      selectionStartPoint.current = clickPoint;
      selectionRectRef.current = clickPoint;
    }

    redrawCanvas();
    return { handled: true, mode: isLassoMode ? 'select-lasso' : 'select-rectangle' };
  };

  const handleMouseMove = (e) => {
    if (isLassoing.current) {
      const currentPoint = canvasHelpers.getCanvasPoint(e);
      if (!currentPoint) return { handled: false };

      // Add point to lasso with throttling (min 3px distance)
      const lastPoint = lassoPoints.current[lassoPoints.current.length - 1];
      const distance = distanceBetweenPoints(currentPoint, lastPoint);

      if (distance > 3) {
        lassoPoints.current.push(currentPoint);
        redrawCanvas();
      }
      return { handled: true };
    }

    if (isSelecting.current) {
      const currentPoint = canvasHelpers.getCanvasPoint(e);
      if (!currentPoint) return { handled: false };

      // Update selection rectangle
      selectionRectRef.current = currentPoint;
      redrawCanvas();
      return { handled: true };
    }

    return { handled: false };
  };

  const handleMouseUp = () => {
    if (isLassoing.current) {
      const rawLassoPoints = lassoPoints.current;

      // Ignore tiny lasso (accidental click)
      if (rawLassoPoints.length < 3) {
        isLassoing.current = false;
        lassoPoints.current = [];
        redrawCanvas();
        return { handled: true };
      }

      // Close and simplify the lasso path
      const closedPath = closeLassoPath(rawLassoPoints);
      const simplifiedPath = simplify(closedPath, 3);

      // Find all strokes that intersect with the lasso
      allStrokesRef.current.forEach((stroke) => {
        if (!stroke.id) return; // Skip strokes without IDs
        ensureBbox(stroke);
        if (doesBboxIntersectPolygon(stroke.bbox, simplifiedPath)) {
          // Check ownership before selecting
          if (canSelectStroke(stroke)) {
            addToSelection(stroke.id);
          }
        }
      });

      // Reset lasso state
      isLassoing.current = false;
      lassoPoints.current = [];
      redrawCanvas();
      return { handled: true };
    }

    if (isSelecting.current) {
      // Complete rectangle selection
      const selectionRect = {
        minX: Math.min(
          selectionStartPoint.current.x,
          selectionRectRef.current.x
        ),
        maxX: Math.max(
          selectionStartPoint.current.x,
          selectionRectRef.current.x
        ),
        minY: Math.min(
          selectionStartPoint.current.y,
          selectionRectRef.current.y
        ),
        maxY: Math.max(
          selectionStartPoint.current.y,
          selectionRectRef.current.y
        ),
      };

      // Find intersecting strokes
      allStrokesRef.current.forEach((stroke) => {
        if (!stroke.id) return; // Skip strokes without IDs
        ensureBbox(stroke);
        if (rectangleIntersectsBoundingBox(selectionRect, stroke.bbox)) {
          // Check ownership before selecting
          if (canSelectStroke(stroke)) {
            addToSelection(stroke.id);
          }
        }
      });

      // Reset selection state
      isSelecting.current = false;
      selectionStartPoint.current = null;
      selectionRectRef.current = null;
      redrawCanvas();
      return { handled: true };
    }

    return { handled: false };
  };

  // Select the top-most object under a point (tap on touch, where there's no Ctrl to individual-select).
  // additive=false replaces the selection; true toggles like Ctrl+click. Reuses the same hit-test +
  // ownership rules as handleMouseDown. Returns true if an object was hit.
  const selectAtPoint = (point, { additive = false } = {}) => {
    if (!canEditRef.current || !point) return false;
    const strokesArray = Array.from(allStrokesRef.current.values());
    let clickedStroke = null;
    for (let i = strokesArray.length - 1; i >= 0; i--) {
      const stroke = strokesArray[i];
      ensureBbox(stroke);
      const hit = stroke.type === 'text'
        ? textContainsPoint(stroke, point)
        : stroke.bbox && pointInBoundingBox(point, stroke.bbox, 5);
      if (hit) { clickedStroke = stroke; break; }
    }

    if (!clickedStroke || !clickedStroke.id) {
      // Empty tap clears selection (replace mode only), matching desktop click-on-empty.
      if (!additive) { clearSelection(); redrawCanvas(); }
      return false;
    }
    if (!canSelectStroke(clickedStroke)) return false;

    if (additive) {
      if (isStrokeSelected(clickedStroke.id)) removeFromSelection(clickedStroke.id);
      else addToSelection(clickedStroke.id);
    } else {
      clearSelection();
      addToSelection(clickedStroke.id);
    }
    redrawCanvas();
    return true;
  };

  // Abandon an in-progress marquee/lasso without committing a selection (e.g. gesture escalated
  // to two fingers). No selection change has happened yet — selection commits only on mouse up.
  const cancel = () => {
    if (!isSelecting.current && !isLassoing.current) {
      return { handled: false };
    }
    isSelecting.current = false;
    isLassoing.current = false;
    selectionStartPoint.current = null;
    selectionRectRef.current = null;
    lassoPoints.current = [];
    redrawCanvas();
    return { handled: true };
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancel,
    selectAtPoint,
    // Export refs for renderer to draw selection visuals
    isSelecting,
    isLassoing,
    selectionStartPoint,
    lassoPoints,
  };
}
