import { useRef, useEffect } from "react";
import { createLine, createCircle, createRectangle, createTriangle, createArrow, createCurvedArrow, createAdaptiveCurvedArrow } from "../../../utils/drawShape";
import { generateUniqueId } from "../../../utils/idGenerator";

export function useInsertShapeMode({
  canvasRef,
  viewport,
  canvasHelpers,
  brushSettings,
  insertShapeType,
  isInsertShapeMode,
  operationManager,
  tempCanvasImgRef,
  clearSelection,
  redrawCanvas,
  canEdit,
}) {
  const isDrawing = useRef(false);
  const startPoint = useRef(null);
  const currentBrushSettingsRef = useRef(brushSettings);
  const currentStrokeIdRef = useRef(null);
  const previewShapeRef = useRef(null);
  const drawnPointsRef = useRef([]);
  const canEditRef = useRef(canEdit);

  useEffect(() => {
    currentBrushSettingsRef.current = brushSettings;
    canEditRef.current = canEdit;
  }, [brushSettings, canEdit]);

  const handleMouseDown = (e) => {
    if (!canEditRef.current || !isInsertShapeMode || e.button !== 0) {
      return { handled: false };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const ctx = canvasHelpers.getContext();
    if (!ctx) return { handled: false };

    const clickPoint = canvasHelpers.getCanvasPoint(e);
    if (!clickPoint) return { handled: false };

    clearSelection();
    redrawCanvas();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tempCanvasImgRef.current = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    ctx.restore();

    isDrawing.current = true;
    startPoint.current = clickPoint;

    // For curved arrows, initialize freehand drawing
    if (insertShapeType === "curved-arrow") {
      drawnPointsRef.current = [clickPoint];
    }

    currentStrokeIdRef.current = generateUniqueId('shape');

    return { handled: true, mode: 'insert-shape' };
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) {
      return { handled: false };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const ctx = canvasHelpers.getContext();
    if (!ctx) return { handled: false };

    const currentPoint = canvasHelpers.getCanvasPoint(e);
    if (!currentPoint) return { handled: false };

    // For curved arrows, collect points freehand style
    if (insertShapeType === "curved-arrow") {
      drawnPointsRef.current.push(currentPoint);
    }

    if (tempCanvasImgRef.current !== null) {
      canvasHelpers.clearCanvas();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(tempCanvasImgRef.current, 0, 0);
      ctx.restore();
    }

    let shapePoints;
    if (insertShapeType === "curved-arrow") {
      // Draw freehand preview for curved arrows
      shapePoints = drawnPointsRef.current;
    } else {
      // Generate geometric shape for other types
      shapePoints = generateShapePoints(
        insertShapeType,
        startPoint.current,
        currentPoint
      );
    }

    previewShapeRef.current = shapePoints;

    viewport.applyTransform(ctx, canvas.width, canvas.height);

    const drawConfig = {
      color: "orange",
      width: currentBrushSettingsRef.current.width,
    };

    canvasHelpers.drawStroke(shapePoints, drawConfig);

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

    isDrawing.current = false;

    if (tempCanvasImgRef.current !== null) {
      canvasHelpers.clearCanvas();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(tempCanvasImgRef.current, 0, 0);
      ctx.restore();
      tempCanvasImgRef.current = null;
    }

    if (previewShapeRef.current && previewShapeRef.current.length > 1) {
      let finalShape = previewShapeRef.current;

      // For curved arrows, fit a perfect curved arrow to the drawn path
      if (insertShapeType === "curved-arrow" && drawnPointsRef.current.length > 2) {
        const points = drawnPointsRef.current;
        const start = points[0];
        const end = points[points.length - 1];
        const distance = Math.hypot(end.x - start.x, end.y - start.y);
        const arrowHeadSize = Math.min(distance * 0.2, 30);

        finalShape = createAdaptiveCurvedArrow(points, arrowHeadSize);
      }

      operationManager.addStroke(
        currentStrokeIdRef.current,
        finalShape,
        currentBrushSettingsRef.current
      );

      viewport.applyTransform(ctx, canvas.width, canvas.height);
      canvasHelpers.drawStroke(finalShape, currentBrushSettingsRef.current);
    }

    startPoint.current = null;
    previewShapeRef.current = null;
    currentStrokeIdRef.current = null;
    drawnPointsRef.current = [];

    return { handled: true };
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

function generateShapePoints(shapeType, startPoint, endPoint) {
  switch (shapeType) {
    case "line":
      return createLine(startPoint, endPoint);

    case "circle": {
      const centerX = (startPoint.x + endPoint.x) / 2;
      const centerY = (startPoint.y + endPoint.y) / 2;
      const radius = Math.hypot(
        endPoint.x - startPoint.x,
        endPoint.y - startPoint.y
      ) / 2;
      return createCircle({ x: centerX, y: centerY }, radius);
    }

    case "rectangle":
      return createRectangle(startPoint, endPoint);

    case "triangle": {
      const topPoint = {
        x: (startPoint.x + endPoint.x) / 2,
        y: Math.min(startPoint.y, endPoint.y),
      };
      const bottomLeft = {
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.max(startPoint.y, endPoint.y),
      };
      const bottomRight = {
        x: Math.max(startPoint.x, endPoint.x),
        y: Math.max(startPoint.y, endPoint.y),
      };
      return createTriangle(topPoint, bottomLeft, bottomRight);
    }

    case "arrow": {
      const distance = Math.hypot(
        endPoint.x - startPoint.x,
        endPoint.y - startPoint.y
      );
      const arrowHeadSize = Math.min(distance * 0.2, 30);
      return createArrow(startPoint, endPoint, arrowHeadSize);
    }

    case "curved-arrow": {
      const distance = Math.hypot(
        endPoint.x - startPoint.x,
        endPoint.y - startPoint.y
      );
      const arrowHeadSize = Math.min(distance * 0.2, 30);
      return createCurvedArrow(startPoint, endPoint, arrowHeadSize, 0.3);
    }

    default:
      return [startPoint, endPoint];
  }
}
