import { useCallback } from "react";
import { logger } from "../../utils/logger";

/**
 * Centralized canvas rendering logic
 * Handles the complex orchestration of drawing all layers in correct order
 */
/**
 * Render multiline text on canvas
 */
function renderMultilineText(ctx, text, x, y, fontSize, color) {
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2; // Same as textarea

  ctx.save();
  ctx.font = `${fontSize}px Comic Sans MS, cursive`;
  ctx.fillStyle = color || '#000000';

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });

  ctx.restore();
}

export function useCanvasRenderer({
  canvasRef,
  viewport,
  drawCallback,
  showGrid,
  drawGrid,
  canvasHelpers,
  // Stroke refs
  allStrokesRef,
  ongoingStrokeRef,
  selectedStrokeIdsRef,
  selectionRectRef,
  hoveredStrokeRef,
  // Mode state refs
  isSelecting,
  isMoving,
  isResizing,
  isRotating,
  isLassoing,
  selectionStartPoint,
  lassoPoints,
  currentMoveOffset,
  brushSettings,
  // Drawing functions from other hooks
  drawRemoteOngoingStrokesRef,
  drawUserCursorsRef,
  drawSelectionRectangle,
  drawBoundingBox,
  drawLassoPath,
  // Utility functions
  isStrokeSelected,
  getCombinedBoundingBox,
  // Transform utilities
  translatePoints,
  drawResizeHandles,
  drawRotationHandle,
  computeBoundingBox,
}) {
  const redrawCanvas = useCallback(() => {
    // Step 1: Clear canvas
    canvasHelpers.clearCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvasHelpers.getContext();
    if (!ctx) return;

    // Step 2: Apply viewport transformation
    viewport.applyTransform(ctx, canvas.width, canvas.height);

    // Step 3: Get current zoom
    const currentZoom = viewport.getCurrentZoom();

    // Step 4: Draw grid if enabled
    if (drawGrid) {
      drawGrid(ctx, canvas, currentZoom);
    }

    // Step 5 & 6: Draw all strokes and text from unified storage (exclude selected if moving)
    allStrokesRef.current.forEach((stroke) => {
      // Skip selected strokes if we're moving them (they'll be drawn with preview)
      if (isMoving.current && selectedStrokeIdsRef.current.has(stroke.id)) {
        return;
      }

      // Skip text attached to moving shapes (they'll be drawn with preview)
      if (isMoving.current &&
          stroke.type === 'text' &&
          stroke.attachedTo &&
          selectedStrokeIdsRef.current.has(stroke.attachedTo)) {
        return;
      }

      if (stroke.type === 'text') {
        // Draw text object (multiline support)
        if (stroke.text && stroke.fontSize) {
          renderMultilineText(ctx, stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config.color);
        }
      } else if (stroke.points && Array.isArray(stroke.points)) {
        // Draw regular stroke
        const { points, config } = stroke;
        for (let i = 1; i < points.length; i++) {
          drawCallback(points[i - 1], points[i], ctx, config, currentZoom);
        }
      }
    });

    // Step 8: Draw remote ongoing strokes (orange previews)
    if (drawRemoteOngoingStrokesRef.current) {
      drawRemoteOngoingStrokesRef.current(ctx, drawCallback, viewport);
    }

    // Step 9: Draw local ongoing stroke (orange preview)
    if (ongoingStrokeRef.current && ongoingStrokeRef.current.length > 1) {
      const drawConfig = {
        color: "orange",
        width: brushSettings.width,
      };
      for (let i = 1; i < ongoingStrokeRef.current.length; i++) {
        drawCallback(
          ongoingStrokeRef.current[i - 1],
          ongoingStrokeRef.current[i],
          ctx,
          drawConfig,
          currentZoom
        );
      }
    }

    // Step 10: Draw user cursors from other users
    if (
      drawUserCursorsRef.current &&
      typeof drawUserCursorsRef.current === "function"
    ) {
      try {
        drawUserCursorsRef.current(ctx, canvas.width, canvas.height);
      } catch (error) {
        logger.warn("Error drawing user cursors:", error);
      }
    }

    // Step 11: Draw selection rectangle if actively selecting
    if (
      isSelecting.current &&
      selectionStartPoint.current &&
      selectionRectRef.current
    ) {
      drawSelectionRectangle(
        ctx,
        selectionStartPoint.current,
        selectionRectRef.current
      );
    }

    // Step 12: Draw lasso path if actively lassoing
    if (isLassoing.current && lassoPoints.current.length > 1) {
      drawLassoPath(ctx, lassoPoints.current);
    }

    // Step 13: Draw combined bounding box for selected strokes with previews
    if (selectedStrokeIdsRef.current.size > 0) {
      let combinedBbox = getCombinedBoundingBox();

      if (combinedBbox) {
        // If moving, draw preview of all selected strokes/text at offset position
        if (isMoving.current && currentMoveOffset.current) {
          selectedStrokeIdsRef.current.forEach(strokeId => {
            const stroke = allStrokesRef.current.get(strokeId);
            if (stroke) {
              if (stroke.type === 'text' && stroke.text && stroke.fontSize) {
                // Draw moved text (multiline support)
                renderMultilineText(
                  ctx,
                  stroke.text,
                  stroke.x + currentMoveOffset.current.x,
                  stroke.y + currentMoveOffset.current.y,
                  stroke.fontSize,
                  stroke.config.color
                );
              } else if (stroke.points && Array.isArray(stroke.points)) {
                // Draw moved stroke
                const offsetPoints = translatePoints(
                  stroke.points,
                  currentMoveOffset.current.x,
                  currentMoveOffset.current.y
                );
                for (let i = 1; i < offsetPoints.length; i++) {
                  drawCallback(
                    offsetPoints[i - 1],
                    offsetPoints[i],
                    ctx,
                    stroke.config,
                    currentZoom
                  );
                }
              }
            }
          });

          // Also draw any text attached to selected shapes (even if text itself isn't selected)
          allStrokesRef.current.forEach((textStroke) => {
            if (textStroke.type === 'text' &&
                textStroke.attachedTo &&
                selectedStrokeIdsRef.current.has(textStroke.attachedTo) &&
                !selectedStrokeIdsRef.current.has(textStroke.id)) { // Not already drawn above

              if (textStroke.text && textStroke.fontSize) {
                renderMultilineText(
                  ctx,
                  textStroke.text,
                  textStroke.x + currentMoveOffset.current.x,
                  textStroke.y + currentMoveOffset.current.y,
                  textStroke.fontSize,
                  textStroke.config.color
                );
              }
            }
          });

          // Offset the combined bbox for selection outline
          combinedBbox = {
            minX: combinedBbox.minX + currentMoveOffset.current.x,
            maxX: combinedBbox.maxX + currentMoveOffset.current.x,
            minY: combinedBbox.minY + currentMoveOffset.current.y,
            maxY: combinedBbox.maxY + currentMoveOffset.current.y,
            width: combinedBbox.width,
            height: combinedBbox.height,
            centerX: combinedBbox.centerX + currentMoveOffset.current.x,
            centerY: combinedBbox.centerY + currentMoveOffset.current.y,
          };
        }

        // Step 14: Draw single combined bounding box
        drawBoundingBox(ctx, combinedBbox);

        // Step 15: Draw resize and rotation handles on combined bbox
        drawResizeHandles(ctx, combinedBbox);
        drawRotationHandle(ctx, combinedBbox);
      }
    }

    // Step 16: Draw hover tooltip (if hovering over a stroke)
    if (hoveredStrokeRef?.current) {
      const hoveredStroke = hoveredStrokeRef.current;
      const username = hoveredStroke.username || 'Unknown';

      // Only show tooltip if stroke has a username (not orphaned)
      if (hoveredStroke.username) {
        const bbox = hoveredStroke.bbox || computeBoundingBox(hoveredStroke.points);

        // Prepare text
        ctx.save();
        ctx.font = `${14 / currentZoom}px Arial`;
        const textMetrics = ctx.measureText(username);
        const textWidth = textMetrics.width;
        const textHeight = 14 / currentZoom;
        const padding = 6 / currentZoom;

        // Position tooltip above bbox
        const tooltipX = bbox.minX;
        const tooltipY = bbox.minY - textHeight - padding * 3;
        const tooltipWidth = textWidth + padding * 2;
        const tooltipHeight = textHeight + padding * 2;

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

        // Draw text
        ctx.fillStyle = 'white';
        ctx.fillText(username, tooltipX + padding, tooltipY + textHeight + padding / 2);
        ctx.restore();
      }
    }
  }, [
    canvasHelpers,
    canvasRef,
    viewport,
    drawCallback,
    drawGrid,
    showGrid,
    // Refs are stable and shouldn't be in deps, but keeping for linter
    allStrokesRef,
    ongoingStrokeRef,
    selectedStrokeIdsRef,
    selectionRectRef,
    hoveredStrokeRef,
    isSelecting,
    isMoving,
    isResizing,
    isRotating,
    isLassoing,
    selectionStartPoint,
    lassoPoints,
    currentMoveOffset,
    brushSettings,
    drawRemoteOngoingStrokesRef,
    drawUserCursorsRef,
    drawSelectionRectangle,
    drawBoundingBox,
    drawLassoPath,
    isStrokeSelected,
    getCombinedBoundingBox,
    translatePoints,
    drawResizeHandles,
    drawRotationHandle,
    computeBoundingBox,
  ]);

  return {
    redrawCanvas,
  };
}
