import React, { useEffect, useRef, useCallback } from "react";
import { useViewportContext } from "../contexts/ViewportContext";
import { useAppState } from "../contexts/AppStateContext";
import { useCanvasContext } from "../contexts/CanvasContext";
import { useCollaborativeStrokes } from "./useCollaborativeStrokes";
import { useUserPresence } from "./useUserPresence";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useCanvasPersistence } from "../contexts/CanvasPersistenceContext";
import { useOperationManager } from "./useOperationManager";
import { useCanvasHelpers } from "./drawing/useCanvasHelpers";
import { useCanvasRenderer } from "./drawing/useCanvasRenderer";
import { usePanMode } from "./drawing/modes/usePanMode";
import { useDrawMode } from "./drawing/modes/useDrawMode";
import { useInsertShapeMode } from "./drawing/modes/useInsertShapeMode";
import { useSelectMode } from "./drawing/modes/useSelectMode";
import { useTransformMode } from "./drawing/modes/useTransformMode";
import { useKeyboardMode } from "./drawing/modes/useKeyboardMode";
import { useTextMode } from "./drawing/modes/useTextMode";
import { computeBoundingBox, translatePoints, pointInBoundingBox } from "../utils/geometry";
import { drawResizeHandles, drawRotationHandle } from "../utils/handles";

export function useDraw(canvasRef, drawCallback, textEditorRef = null) {
  const { viewport } = useViewportContext();
  const appState = useAppState();
  const canvas = useCanvasContext();
  const socket = useSocket();
  const { user } = useAuth();
  const { myUserInfo } = socket;
  const { canEdit, markUnsavedChanges, userRole, isOwner } = useCanvasPersistence();

  const { brushSettings, showGrid, brushType, isSelectMode, isLassoMode, isInsertShapeMode, isTextMode, insertShapeType } =
    appState;

  const redrawCallbackRef = useRef(null);
  const drawRemoteOngoingStrokesRef = useRef(null);
  const drawUserCursorsRef = useRef(null);
  const hoveredStrokeRef = useRef(null); // Track hovered stroke for tooltip
  const textClickCallbackRef = useRef(null); // Callback for text tool clicks
  const lastMousePosRef = useRef({ x: 0, y: 0 }); // Track last mouse position in canvas coords for paste

  // Use real user ID if authenticated, otherwise use anonymous ID from room:joined
  const userId = user?.id || myUserInfo?.userId || socket.id || `guest_${Date.now()}`;
  const username = user?.displayName || user?.username || myUserInfo?.username || 'Guest';

  const operationManager = useOperationManager(
    socket.currentRoom ? userId : null,
    redrawCallbackRef,
    username,
    markUnsavedChanges  // Pass change tracking callback
  );

  // Initialize canvas helpers
  const canvasHelpers = useCanvasHelpers(canvasRef, viewport, drawCallback);

  const drawGrid = useCallback(
    (ctx, canvas, currentZoom) => {
      if (showGrid === false) return;

      ctx.save();
      ctx.fillStyle = `rgba(128, 128, 128, 0.6)`; // Use fill instead of stroke for better visibility

      const gridSpacing = 100; // Keep consistent spacing
      const dotSize = 2; // Fixed visible dot size

      // Calculate larger bounds to cover full canvas area
      const canvasRange = Math.max(canvas.width, canvas.height) / currentZoom;
      const gridRange = canvasRange * 1.5; // Extend beyond visible area
      const startX = -gridRange;
      const endX = gridRange;
      const startY = -gridRange;
      const endY = gridRange;

      // Draw dots efficiently
      for (
        let x = Math.floor(startX / gridSpacing) * gridSpacing;
        x <= endX;
        x += gridSpacing
      ) {
        for (
          let y = Math.floor(startY / gridSpacing) * gridSpacing;
          y <= endY;
          y += gridSpacing
        ) {
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      ctx.restore();
    },
    [showGrid]
  );

  // Drawing refs are now managed by useDrawMode
  // Selection refs are now managed by useSelectMode
  // Transform refs are now managed by useTransformMode

  // Helper functions are now provided by canvasHelpers hook

  const drawSelectionRectangle = useCallback((ctx, startPoint, endPoint) => {
    if (!startPoint || !endPoint) return;

    const minX = Math.min(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    ctx.save();
    ctx.strokeStyle = "#f08080"; // Coral
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(minX, minY, width, height);
    ctx.fillStyle = "rgba(240, 128, 128, 0.15)"; // Coral with transparency
    ctx.fillRect(minX, minY, width, height);
    ctx.restore();

    return { minX, maxX: minX + width, minY, maxY: minY + height };
  }, []);

  const drawBoundingBox = useCallback((ctx, bbox) => {
    if (!bbox) return;

    ctx.save();
    ctx.strokeStyle = "#f08080"; // Coral
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bbox.minX, bbox.minY, bbox.width, bbox.height);
    // Removed fill - outline only

    ctx.restore();
  }, []);

  const drawLassoPath = useCallback((ctx, points) => {
    if (!points || points.length < 2) return;

    ctx.save();

    // Draw the lasso path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    // Draw closing line preview (from last point back to first)
    if (points.length > 2) {
      ctx.lineTo(points[0].x, points[0].y);
    }

    ctx.strokeStyle = "#f08080"; // Coral
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // Semi-transparent fill
    ctx.fillStyle = "rgba(240, 128, 128, 0.15)"; // Coral with transparency
    ctx.fill();

    ctx.restore();
  }, []);

  const getCombinedBoundingBox = useCallback(() => {
    if (canvas.selectedStrokeIdsRef.current.size === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    canvas.selectedStrokeIdsRef.current.forEach((strokeId) => {
      const stroke = canvas.textDraftRef.current?.object.id === strokeId ? canvas.textDraftRef.current.object : canvas.allStrokesRef.current.get(strokeId);
      if (stroke) {
        if (!stroke.bbox) {
          stroke.bbox = computeBoundingBox(stroke.points);
        }

        minX = Math.min(minX, stroke.bbox.minX);
        maxX = Math.max(maxX, stroke.bbox.maxX);
        minY = Math.min(minY, stroke.bbox.minY);
        maxY = Math.max(maxY, stroke.bbox.maxY);
      }
    });

    if (minX === Infinity) return null;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [canvas]);

  // Placeholder redrawCanvas for collaborative hooks (real one comes from renderer)
  const placeholderRedraw = useCallback(() => {
    if (redrawCallbackRef.current) {
      redrawCallbackRef.current();
    }
  }, []);

  // Initialize collaborative hooks with placeholder
  const { drawRemoteOngoingStrokes } = useCollaborativeStrokes(
    placeholderRedraw,
    operationManager
  );
  const { drawUserCursors } = useUserPresence(
    canvasRef,
    viewport,
    placeholderRedraw
  );

  // Initialize select mode (before renderer so we can pass its refs)
  const selectMode = useSelectMode({
    canvasHelpers,
    isSelectMode,
    isLassoMode,
    allStrokesRef: canvas.allStrokesRef,
    selectionRectRef: canvas.selectionRectRef,
    addToSelection: canvas.addToSelection,
    removeFromSelection: canvas.removeFromSelection,
    clearSelection: canvas.clearSelection,
    isStrokeSelected: canvas.isStrokeSelected,
    redrawCanvas: placeholderRedraw,
    canEdit,
    userId,
    userRole,
    isOwner,
  });

  const transformMode = useTransformMode({
    canvasRef,
    canvasHelpers,
    viewport,
    isSelectMode: isSelectMode || isTextMode,
    selectedStrokeIdsRef: canvas.selectedStrokeIdsRef,
    allStrokesRef: canvas.allStrokesRef,
    operationManager,
    getCombinedBoundingBox,
    redrawCanvas: placeholderRedraw,
    canEdit,
    userId,
    userRole,
    isOwner,
  });

  // Initialize keyboard mode
  const keyboardMode = useKeyboardMode({
    operationManager,
    selectedStrokeIdsRef: canvas.selectedStrokeIdsRef,
    allStrokesRef: canvas.allStrokesRef,
    isLassoing: selectMode.isLassoing,
    lassoPoints: selectMode.lassoPoints,
    clearSelection: canvas.clearSelection,
    redrawCanvas: placeholderRedraw,
    canEdit,
    lastMousePosRef,
  });

  // Now initialize the canvas renderer with all dependencies
  const { redrawCanvas } = useCanvasRenderer({
    canvasRef,
    viewport,
    drawCallback,
    showGrid,
    drawGrid,
    canvasHelpers,
    redrawCallbackRef, // lets async text rasters trigger a repaint when they decode
    // Stroke refs
    allStrokesRef: canvas.allStrokesRef,
    ongoingStrokeRef: canvas.ongoingStrokeRef,
    selectedStrokeIdsRef: canvas.selectedStrokeIdsRef,
    selectionRectRef: canvas.selectionRectRef,
    hoveredStrokeRef, // For tooltip display
    // Mode state refs
    isSelecting: selectMode.isSelecting,
    isMoving: transformMode.isMoving,
    isResizing: transformMode.isResizing,
    isRotating: transformMode.isRotating,
    isLassoing: selectMode.isLassoing,
    selectionStartPoint: selectMode.selectionStartPoint,
    lassoPoints: selectMode.lassoPoints,
    currentMoveOffset: transformMode.currentMoveOffset,
    brushSettings,
    // Drawing functions from other hooks
    drawRemoteOngoingStrokesRef,
    drawUserCursorsRef,
    drawSelectionRectangle,
    drawBoundingBox,
    drawLassoPath,
    // Utility functions
    isStrokeSelected: canvas.isStrokeSelected,
    getCombinedBoundingBox,
    // Transform utilities
    translatePoints,
    drawResizeHandles,
    drawRotationHandle,
    computeBoundingBox,
  });

  // Initialize pan mode
  const panMode = usePanMode(canvasRef, viewport, redrawCanvas);

  // Initialize draw mode
  const drawMode = useDrawMode({
    canvasRef,
    viewport,
    drawCallback,
    canvasHelpers,
    brushType,
    brushSettings,
    isSelectMode,
    operationManager,
    currentRoom: socket.currentRoom,
    ongoingStrokeRef: canvas.ongoingStrokeRef,
    tempCanvasImgRef: canvas.tempCanvasImgRef,
    clearSelection: canvas.clearSelection,
    redrawCanvas,
    canEdit,
  });

  // Initialize insert shape mode
  const insertShapeMode = useInsertShapeMode({
    canvasRef,
    viewport,
    canvasHelpers,
    brushSettings,
    insertShapeType,
    isInsertShapeMode,
    operationManager,
    tempCanvasImgRef: canvas.tempCanvasImgRef,
    clearSelection: canvas.clearSelection,
    redrawCanvas,
    canEdit,
  });

  // Initialize text mode
  const textMode = useTextMode({
    canvasHelpers,
    operationManager,
    textDefaults: appState.textDefaults,
    redrawCanvas,
    allStrokesRef: canvas.allStrokesRef,
    onTextClick: (textPosition) => {
      // Callback will be set from CanvasBoard via setTextClickCallback
      if (textClickCallbackRef.current) {
        textClickCallbackRef.current(textPosition);
      }
    },
    canEdit,
  });

  // Assign functions to refs to break circular dependency
  useEffect(() => {
    redrawCallbackRef.current = redrawCanvas;
    canvas.redrawRef.current = redrawCanvas;
    drawRemoteOngoingStrokesRef.current = drawRemoteOngoingStrokes;
    drawUserCursorsRef.current = drawUserCursors;
  }, [redrawCanvas, drawRemoteOngoingStrokes, drawUserCursors, canvas.redrawRef]);

  useEffect(() => {
    redrawCanvas();
  }, [showGrid, redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;

    const handleMouseDown = (e) => {
      // If text editor is open, blur it first to trigger submit
      // This ensures clicking away from the editor properly saves the text
      if (textEditorRef?.current) {
        textEditorRef.current.blur();
        return;
      }

      // Check pan mode first (highest priority)
      const panResult = panMode.handleMouseDown(e);
      if (panResult.handled) {
        return;
      }

      if (e.button !== 0) {
        return;
      }

      if ((isSelectMode || isTextMode) && e.detail === 2) {
        if (textMode.handleDoubleClick(e).handled) return;
      }
      if (isTextMode) {
        if (transformMode.handleMouseDown(e).handled) return;
      }
      if (isSelectMode) {
        // Check transform mode first (move/resize/rotate)
        const transformResult = transformMode.handleMouseDown(e);
        if (transformResult.handled) {
          return;
        }

        // Then delegate to select mode for Ctrl+click and area selection
        const selectResult = selectMode.handleMouseDown(e);
        if (selectResult.handled) {
          return;
        }
      } else if (isInsertShapeMode) {
        // Insert shape mode - delegate to insertShapeMode
        const insertShapeResult = insertShapeMode.handleMouseDown(e);
        if (insertShapeResult.handled) {
          return;
        }
      } else if (isTextMode) {
        // Text mode - delegate to textMode
        const textResult = textMode.handleMouseDown(e);
        if (textResult.handled) {
          return;
        }
      } else {
        // Drawing mode - delegate to drawMode
        const drawResult = drawMode.handleMouseDown(e);
        if (drawResult.handled) {
          return;
        }
      }
    };

    const handleMouseMove = (e) => {
      // Check pan mode first
      const panResult = panMode.handleMouseMove(e);
      if (panResult.handled) {
        return;
      }

      if (isSelectMode) {
        // Check select mode first for lasso/rectangle selection
        const selectResult = selectMode.handleMouseMove(e);
        if (selectResult.handled) {
          return;
        }

        // Then handle transform operations (move/resize/rotate) and cursor updates
        transformMode.handleMouseMove(e);
      } else if (isTextMode) {
        if (textMode.handleMouseMove(e).handled) return;
        transformMode.handleMouseMove(e);
      } else if (isInsertShapeMode) {
        // Insert shape mode - delegate to insertShapeMode
        const insertShapeResult = insertShapeMode.handleMouseMove(e);
        if (insertShapeResult.handled) {
          return;
        }
      } else {
        // Drawing mode - delegate to drawMode
        const drawResult = drawMode.handleMouseMove(e);
        if (drawResult.handled) {
          return;
        }
      }

      // Track mouse position for paste functionality + hover detection
      const currentPoint = canvasHelpers.getCanvasPoint(e);
      if (currentPoint) {
        lastMousePosRef.current = currentPoint;
      }

      // Hover detection for tooltip (only when not in active mode)
      if (currentPoint && canvas.allStrokesRef?.current && 
          !selectMode.isSelecting?.current && !selectMode.isLassoing?.current &&
          !transformMode.isMoving?.current && !transformMode.isResizing?.current && !transformMode.isRotating?.current) {
        // Find which stroke is under cursor (search from top-most)
        const strokesArray = Array.from(canvas.allStrokesRef.current.values());
        let hoveredStroke = null;
        for (let i = strokesArray.length - 1; i >= 0; i--) {
          const stroke = strokesArray[i];
          if (!stroke.bbox) {
            stroke.bbox = computeBoundingBox(stroke.points);
          }
          if (pointInBoundingBox(currentPoint, stroke.bbox, 5)) {
            hoveredStroke = stroke;
            break;
          }
        }

        // Update hover state and redraw if changed
        if (hoveredStrokeRef.current !== hoveredStroke) {
          hoveredStrokeRef.current = hoveredStroke;
          redrawCanvas();
        }
      } else if (hoveredStrokeRef.current) {
        // Clear hover when in active mode
        hoveredStrokeRef.current = null;
        redrawCanvas();
      }
    };

    const handleMouseUp = (e) => {
      // Check pan mode first
      const panResult = panMode.handleMouseUp();
      if (panResult.handled) {
        return;
      }

      if (isTextMode) {
        if (textMode.handleMouseUp(e).handled) return;
        if (transformMode.handleMouseUp(e).handled) return;
      }
      if (isSelectMode) {
        // Check select mode first for lasso/rectangle selection completion
        const selectResult = selectMode.handleMouseUp();
        if (selectResult.handled) {
          return;
        }

        // Then handle transform operations (move/resize/rotate)
        const transformResult = transformMode.handleMouseUp(e);
        if (transformResult.handled) {
          return;
        }
      } else if (isInsertShapeMode) {
        // Insert shape mode - delegate to insertShapeMode
        const insertShapeResult = insertShapeMode.handleMouseUp();
        if (insertShapeResult.handled) {
          return;
        }
      }

      // Drawing mode - delegate to drawMode
      const drawResult = drawMode.handleMouseUp();
      if (drawResult.handled) {
        return;
      }
    };

    // Keyboard handlers are now provided by keyboardMode

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleWheel = (e) => {
      // Mouse wheel for zooming (no Ctrl required)
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.deltaY < 0) {
        viewport.zoomIn(cursorX, cursorY, canvas.width, canvas.height);
      } else {
        viewport.zoomOut(cursorX, cursorY, canvas.width, canvas.height);
      }
      redrawCanvas();
    };

    const handleTextEscape = e => { if (e.key === 'Escape') textMode.cancelCreation(); };
    window.addEventListener('keydown', handleTextEscape);
    window.addEventListener('text-fonts-ready', redrawCanvas);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("wheel", handleWheel);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", keyboardMode.handleUndo);
    window.addEventListener("keydown", keyboardMode.handleRedo);
    window.addEventListener("keydown", keyboardMode.handleDeleteSelected);
    window.addEventListener("keydown", keyboardMode.handleSelectAll);
    window.addEventListener("keydown", keyboardMode.handleCancelLasso);
    window.addEventListener("keydown", keyboardMode.handleCopy);
    window.addEventListener("keydown", keyboardMode.handlePaste);

    return () => {
      window.removeEventListener('keydown', handleTextEscape);
      window.removeEventListener('text-fonts-ready', redrawCanvas);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", keyboardMode.handleUndo);
      window.removeEventListener("keydown", keyboardMode.handleRedo);
      window.removeEventListener("keydown", keyboardMode.handleDeleteSelected);
      window.removeEventListener("keydown", keyboardMode.handleSelectAll);
      window.removeEventListener("keydown", keyboardMode.handleCancelLasso);
      window.removeEventListener("keydown", keyboardMode.handleCopy);
      window.removeEventListener("keydown", keyboardMode.handlePaste);
    };
  }, [
    textEditorRef,
    canvasRef,
    drawCallback,
    viewport,
    showGrid,
    canvasHelpers,
    panMode,
    drawMode,
    insertShapeMode,
    textMode,
    selectMode,
    transformMode,
    keyboardMode,
    redrawCanvas,
    brushType,
    isSelectMode,
    isLassoMode,
    isInsertShapeMode,
    isTextMode,
    canvas,
    socket,
    operationManager,
    getCombinedBoundingBox,
  ]);

  // Export undo/redo handlers for UI buttons
  const handleUndo = useCallback(() => {
    if (operationManager.canUndo()) {
      operationManager.undo();
      canvas.clearSelection();
      redrawCanvas();
    }
  }, [operationManager, canvas, redrawCanvas]);

  const handleRedo = useCallback(() => {
    if (operationManager.canRedo()) {
      operationManager.redo();
      canvas.clearSelection();
      redrawCanvas();
    }
  }, [operationManager, canvas, redrawCanvas]);

  return {
    redrawCanvas,
    handleUndo,
    handleRedo,
    operationManager,
    textMode,
    setTextClickCallback: (callback) => {
      textClickCallbackRef.current = callback;
    }
  };
}
