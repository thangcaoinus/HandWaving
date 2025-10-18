import { useCallback } from "react";

/**
 * Provides common canvas operations used across all drawing modes
 * Returns object with helper functions instead of destructuring for clarity
 */
export function useCanvasHelpers(canvasRef, viewport, drawCallback) {
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d", { willReadFrequently: true });
  }, [canvasRef]);

  const getCanvasPoint = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      return viewport.screenToCanvas(
        screenX,
        screenY,
        canvas.width,
        canvas.height
      );
    },
    [canvasRef, viewport]
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    viewport.applyTransform(ctx, canvas.width, canvas.height);
  }, [canvasRef, viewport]);

  const drawStroke = useCallback(
    (stroke, config) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const currentZoom = viewport.getCurrentZoom();
      for (let i = 1; i < stroke.length; i++) {
        drawCallback(stroke[i - 1], stroke[i], ctx, config, currentZoom);
      }
    },
    [canvasRef, drawCallback, viewport]
  );

  const drawStrokes = useCallback(
    (strokes) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const currentZoom = viewport.getCurrentZoom();
      for (let i = 0; i < strokes.length; i++) {
        const { points, config } = strokes[i];
        for (let j = 1; j < points.length; j++) {
          drawCallback(points[j - 1], points[j], ctx, config, currentZoom);
        }
      }
    },
    [canvasRef, drawCallback, viewport]
  );

  return {
    getContext,
    getCanvasPoint,
    clearCanvas,
    drawStroke,
    drawStrokes,
  };
}
