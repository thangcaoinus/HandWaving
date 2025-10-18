import { useRef, useEffect } from "react";
import detectShape from "../../../utils/detectShape";
import { snapIntoShape } from "../../../utils/drawShape";
import { generateUniqueId } from "../../../utils/idGenerator";

/**
 * Draw mode handler - freehand and smart shape drawing
 * Handles brush types 1 (freehand) and 2 (smart shapes with detection)
 */
export function useDrawMode({
  canvasRef,
  viewport,
  drawCallback,
  canvasHelpers,
  brushType,
  brushSettings,
  isSelectMode,
  operationManager,
  currentRoom,
  ongoingStrokeRef,
  tempCanvasImgRef,
  clearSelection,
  redrawCanvas,
  canEdit,
}) {
  const isDrawing = useRef(false);
  const prevPoint = useRef(null);
  const currentBrushSettingsRef = useRef(brushSettings);
  const currentStrokeIdRef = useRef(null);
  const canEditRef = useRef(canEdit); // Ref for fresh value

  const lastEventTimeRef = useRef(0);

  const MIN_POINT_DISTANCE = 0.7;

  useEffect(() => {
    currentBrushSettingsRef.current = brushSettings;
    canEditRef.current = canEdit; // Keep ref updated
  }, [brushSettings, canEdit]);

  const handleMouseDown = (e) => {
    const isActive = !isSelectMode && (brushType === 1 || brushType === 2);
    
    // Use ref for fresh value
    if (!canEditRef.current) {
      return { handled: false };
    }
    
    if (!isActive || e.button !== 0) {
      return { handled: false };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const ctx = canvasHelpers.getContext();
    if (!ctx) return { handled: false };

    const clickPoint = canvasHelpers.getCanvasPoint(e);
    if (!clickPoint) return { handled: false };

    // Clear any existing selection when starting to draw
    clearSelection();
    redrawCanvas();

    // Save canvas state for preview
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tempCanvasImgRef.current = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    ctx.restore();

    // Initialize drawing state
    isDrawing.current = true;
    prevPoint.current = clickPoint;
    ongoingStrokeRef.current.push(prevPoint.current);

    // Generate stroke ID for operation management
    currentStrokeIdRef.current = generateUniqueId('stroke');

    // Start collaborative stroke if in a room
    if (currentRoom) {
      operationManager.startStroke(
        currentStrokeIdRef.current,
        prevPoint.current,
        currentBrushSettingsRef.current
      );
    }

    return { handled: true, mode: 'draw' };
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) {
      return { handled: false };
    }

    // Throttle to 60fps (~16.67ms between events)
    const now = performance.now();
    if (now - lastEventTimeRef.current < 16.67) {
      return { handled: true }; // Still handled, just skipped
    }
    lastEventTimeRef.current = now;

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const ctx = canvasHelpers.getContext();
    if (!ctx) return { handled: false };

    const currentPoint = canvasHelpers.getCanvasPoint(e);
    if (!currentPoint) return { handled: false };

    // Distance-based filtering: skip points too close to previous point
    if (ongoingStrokeRef.current.length > 0) {
      const lastPoint = ongoingStrokeRef.current[ongoingStrokeRef.current.length - 1];
      const distance = Math.hypot(
        currentPoint.x - lastPoint.x,
        currentPoint.y - lastPoint.y
      );

      if (distance < MIN_POINT_DISTANCE) {
        return { handled: true }; // Skip this point, too close to previous
      }
    }

    // Apply viewport transformation
    viewport.applyTransform(ctx, canvas.width, canvas.height);

    // Draw orange preview
    const drawConfig = {
      color: "orange",
      width: currentBrushSettingsRef.current.width,
    };
    const currentZoom = viewport.getCurrentZoom();
    drawCallback(
      prevPoint.current,
      currentPoint,
      ctx,
      drawConfig,
      currentZoom
    );

    // Update state
    prevPoint.current = currentPoint;
    ongoingStrokeRef.current.push(prevPoint.current);

    // Broadcast stroke progress
    if (currentRoom && currentStrokeIdRef.current) {
      operationManager.progressStroke(currentStrokeIdRef.current, currentPoint);
    }

    return { handled: true };
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) {
      return { handled: false };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const ctx = canvasHelpers.getContext();
    if (!ctx) return { handled: false };

    // Reset drawing state
    isDrawing.current = false;
    prevPoint.current = null;

    // Create temporary stroke object for processing
    const latestStroke = {
      points: ongoingStrokeRef.current,
      config: currentBrushSettingsRef.current,
    };
    ongoingStrokeRef.current = [];

    // Revert canvas to state before preview
    if (tempCanvasImgRef.current !== null) {
      canvasHelpers.clearCanvas();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(tempCanvasImgRef.current, 0, 0);
      ctx.restore();
      tempCanvasImgRef.current = null;
    }

    // Apply shape detection if enabled (brushType 2)
    const shape = brushType === 2 ? detectShape(latestStroke.points) : null;
    const refinedStroke =
      brushType === 2 ? snapIntoShape(shape) : latestStroke.points;

    // Add stroke using operation manager (handles local state + collaboration)
    operationManager.addStroke(
      currentStrokeIdRef.current,
      refinedStroke,
      latestStroke.config
    );

    // Draw the final refined stroke
    viewport.applyTransform(ctx, canvas.width, canvas.height);
    canvasHelpers.drawStroke(refinedStroke, latestStroke.config);

    // Reset stroke ID
    currentStrokeIdRef.current = null;

    return { handled: true };
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
