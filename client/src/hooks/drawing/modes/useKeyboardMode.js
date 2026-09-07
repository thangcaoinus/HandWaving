import { useRef, useEffect } from "react";
import { generateUniqueId } from "../../../utils/idGenerator";
import { translatePoints } from "../../../utils/geometry";
import { logger } from "../../../utils/logger";

/**
 * Keyboard mode handler - undo, redo, delete, select all, cancel lasso, copy/paste
 * Handles global keyboard shortcuts for canvas operations
 */
export function useKeyboardMode({
  operationManager,
  selectedStrokeIdsRef,
  allStrokesRef,
  isLassoing,
  lassoPoints,
  clearSelection,
  redrawCanvas,
  canEdit,
  lastMousePosRef,
}) {
  const canEditRef = useRef(canEdit);
  const copiedStrokesRef = useRef([]); // Store copied strokes for paste
  const copiedCenterRef = useRef({ x: 0, y: 0 }); // Store center of copied selection

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  const handleUndo = (e) => {
    if (!(e.key.toLowerCase() === "z") || !e.ctrlKey) return { handled: false };
    if (!canEditRef.current) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    e.preventDefault();

    if (operationManager.canUndo()) {
      operationManager.undo();
      clearSelection();
      redrawCanvas();
    }
    return { handled: true };
  };

  const handleRedo = (e) => {
    if (!(e.key.toLowerCase() === "y") || !e.ctrlKey) return { handled: false };
    if (!canEditRef.current) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    e.preventDefault();

    if (operationManager.canRedo()) {
      operationManager.redo();
      clearSelection();
      redrawCanvas();
    }
    return { handled: true };
  };

  const handleDeleteSelected = (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return { handled: false };
    if (!canEditRef.current) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    if (selectedStrokeIdsRef.current.size === 0) return { handled: false };

    e.preventDefault();

    const strokeIdsToDelete = [];
    const deletedStrokeData = [];

    Array.from(selectedStrokeIdsRef.current).forEach((strokeId) => {
      // Find stroke by ID in unified Map storage
      const stroke = allStrokesRef.current.get(strokeId);
      if (stroke) {
        strokeIdsToDelete.push(stroke.id);

        // Save full stroke data for undo (handles both regular strokes and text)
        if (stroke.type === 'text') {
          // Text object - save text-specific properties
          deletedStrokeData.push({
            index: 0,
            stroke: {
              id: stroke.id,
              type: 'text',
              text: stroke.text,
              x: stroke.x,
              y: stroke.y,
              fontSize: stroke.fontSize,
              config: stroke.config,
              attachedTo: stroke.attachedTo,
              bbox: stroke.bbox
            },
          });
        } else {
          // Regular stroke - save points and config
          deletedStrokeData.push({
            index: 0,
            stroke: {
              id: stroke.id,
              points: stroke.points,
              config: stroke.config,
            },
          });
        }
      }
    });

    if (strokeIdsToDelete.length > 0) {
      operationManager.deleteStrokes(strokeIdsToDelete, deletedStrokeData);
      clearSelection();
    }
    return { handled: true };
  };

  const handleSelectAll = (e) => {
    if (!(e.key.toLowerCase() === "a") || !e.ctrlKey) return { handled: false };
    if (!canEditRef.current) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    e.preventDefault();

    selectedStrokeIdsRef.current.clear();
    // Iterate over unified Map storage
    allStrokesRef.current.forEach((stroke) => {
      if (stroke.id) {
        selectedStrokeIdsRef.current.add(stroke.id);
      }
    });
    redrawCanvas();
    return { handled: true };
  };

  const handleCancelLasso = (e) => {
    if (e.key !== "Escape") return { handled: false };

    if (isLassoing.current) {
      isLassoing.current = false;
      lassoPoints.current = [];
      redrawCanvas();
      return { handled: true };
    }

    return { handled: false };
  };

  const handleCopy = (e) => {
    if (!(e.key.toLowerCase() === "c") || !e.ctrlKey) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    if (selectedStrokeIdsRef.current.size === 0) return { handled: false };

    e.preventDefault();

    // Copy selected strokes to clipboard ref
    copiedStrokesRef.current = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const copiedIds = new Set(); // Track what we've copied to avoid duplicates

    Array.from(selectedStrokeIdsRef.current).forEach((strokeId) => {
      const stroke = allStrokesRef.current.get(strokeId);
      if (stroke && !copiedIds.has(strokeId)) {
        copiedIds.add(strokeId);

        // Deep clone the stroke to avoid reference issues
        if (stroke.type === 'text') {
          copiedStrokesRef.current.push({
            type: 'text',
            text: stroke.text,
            x: stroke.x,
            y: stroke.y,
            fontSize: stroke.fontSize,
            config: structuredClone(stroke.config),
            attachedTo: stroke.attachedTo, // Preserve attachment for now
            originalId: strokeId, // Store original ID to remap attachments later
            bbox: { ...stroke.bbox }
          });
          // Update bounds
          minX = Math.min(minX, stroke.bbox.minX);
          minY = Math.min(minY, stroke.bbox.minY);
          maxX = Math.max(maxX, stroke.bbox.maxX);
          maxY = Math.max(maxY, stroke.bbox.maxY);
        } else {
          copiedStrokesRef.current.push({
            points: stroke.points.map(p => ({ ...p })),
            config: structuredClone(stroke.config),
            bbox: stroke.bbox ? { ...stroke.bbox } : null,
            originalId: strokeId
          });
          // Update bounds
          if (stroke.bbox) {
            minX = Math.min(minX, stroke.bbox.minX);
            minY = Math.min(minY, stroke.bbox.minY);
            maxX = Math.max(maxX, stroke.bbox.maxX);
            maxY = Math.max(maxY, stroke.bbox.maxY);
          }

          // Also copy any text attached to this shape
          allStrokesRef.current.forEach((potentialText, textId) => {
            if (potentialText.type === 'text' &&
                potentialText.attachedTo === strokeId &&
                !copiedIds.has(textId)) {
              copiedIds.add(textId);
              copiedStrokesRef.current.push({
                type: 'text',
                text: potentialText.text,
                x: potentialText.x,
                y: potentialText.y,
                fontSize: potentialText.fontSize,
                config: structuredClone(potentialText.config),
                attachedTo: strokeId, // Keep attachment to this shape
                originalId: textId,
                bbox: { ...potentialText.bbox }
              });
              // Update bounds for attached text too
              minX = Math.min(minX, potentialText.bbox.minX);
              minY = Math.min(minY, potentialText.bbox.minY);
              maxX = Math.max(maxX, potentialText.bbox.maxX);
              maxY = Math.max(maxY, potentialText.bbox.maxY);
            }
          });
        }
      }
    });

    // Calculate center of copied selection
    copiedCenterRef.current = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };

    logger.log('📋 Copied', copiedStrokesRef.current.length, 'strokes, center:', copiedCenterRef.current);
    return { handled: true };
  };

  const handlePaste = (e) => {
    if (!(e.key.toLowerCase() === "v") || !e.ctrlKey) return { handled: false };
    if (!canEditRef.current) return { handled: false };

    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return { handled: false };
    }

    if (copiedStrokesRef.current.length === 0) return { handled: false };

    e.preventDefault();

    // Use last tracked mouse position (updated on every mousemove)
    const cursorPos = lastMousePosRef.current;

    // Calculate offset to center pasted selection at cursor
    const offsetX = cursorPos.x - copiedCenterRef.current.x;
    const offsetY = cursorPos.y - copiedCenterRef.current.y;

    // First pass: Create ID mapping (old ID -> new ID)
    const idMapping = new Map();
    copiedStrokesRef.current.forEach((copiedStroke) => {
      const newId = copiedStroke.type === 'text'
        ? generateUniqueId('text')
        : generateUniqueId('stroke');
      idMapping.set(copiedStroke.originalId, newId);
    });

    // Second pass: Create new strokes with new IDs and remapped attachments
    const newStrokes = copiedStrokesRef.current.map((copiedStroke) => {
      const newId = idMapping.get(copiedStroke.originalId);

      if (copiedStroke.type === 'text') {
        // Text object - offset position and remap attachedTo if present
        let newAttachedTo = null;
        if (copiedStroke.attachedTo && idMapping.has(copiedStroke.attachedTo)) {
          newAttachedTo = idMapping.get(copiedStroke.attachedTo);
        }

        return {
          id: newId,
          type: 'text',
          text: copiedStroke.text,
          x: copiedStroke.x + offsetX,
          y: copiedStroke.y + offsetY,
          fontSize: copiedStroke.fontSize,
          config: structuredClone(copiedStroke.config),
          attachedTo: newAttachedTo,
          bbox: {
            minX: copiedStroke.bbox.minX + offsetX,
            maxX: copiedStroke.bbox.maxX + offsetX,
            minY: copiedStroke.bbox.minY + offsetY,
            maxY: copiedStroke.bbox.maxY + offsetY
          }
        };
      } else {
        // Regular stroke - translate points
        const translatedPoints = translatePoints(copiedStroke.points, offsetX, offsetY);
        return {
          id: newId,
          points: translatedPoints,
          config: structuredClone(copiedStroke.config),
          bbox: copiedStroke.bbox ? {
            minX: copiedStroke.bbox.minX + offsetX,
            maxX: copiedStroke.bbox.maxX + offsetX,
            minY: copiedStroke.bbox.minY + offsetY,
            maxY: copiedStroke.bbox.maxY + offsetY
          } : null
        };
      }
    });

    // Use batch add operation
    operationManager.batchAddStrokes(newStrokes);

    // Select the newly pasted strokes
    clearSelection();
    newStrokes.forEach(stroke => {
      selectedStrokeIdsRef.current.add(stroke.id);
    });

    redrawCanvas();

    logger.log('📌 Pasted', newStrokes.length, 'strokes at cursor', cursorPos);
    return { handled: true };
  };

  return {
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleSelectAll,
    handleCancelLasso,
    handleCopy,
    handlePaste,
  };
}
