import { useCallback } from "react";
import { getTextImage } from "../../utils/textRasterCache";
import { getImage } from "../../utils/imageCache";
import { getTextLayout, refreshTextBounds } from '../../utils/textBbox';
import { refreshImageBounds } from '../../utils/imageBbox';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { logger } from "../../utils/logger";

/**
 * Centralized canvas rendering logic
 * Handles the complex orchestration of drawing all layers in correct order
 */

/**
 * Render a text object (Markdown + KaTeX) onto the canvas.
 *
 * Text is no longer fillText'd — it's rendered to an image (source -> HTML -> SVG ->
 * <img>) and cached. We draw the cached raster at the block's top-left (x, y-fontSize).
 * On a cache miss the image isn't ready yet, so we draw a faint placeholder and let the
 * cache call triggerRedraw when it decodes.
 *
 * `atX/atY` let move-previews draw the same cached image at an offset without re-rastering.
 */
function renderTextObject(ctx, stroke, currentZoom, triggerRedraw, atX, atY) {
  if (!stroke.text || !stroke.fontSize) return;
  const x = atX ?? stroke.x;
  const y = atY ?? stroke.y;
  const color = (stroke.config && stroke.config.color) || '#000000';

  const { image, w, h, ready, failed } = getTextImage(
    { text: stroke.text, fontSize: stroke.fontSize, color, zoom: currentZoom, config: stroke.config },
    triggerRedraw
  );

  const layout = getTextLayout(stroke.text, stroke.fontSize, stroke.config);
  const top = y - stroke.fontSize + layout.offsetY; // (x,y) is the first-line anchor; block grows downward

  if (ready && image) {
    ctx.drawImage(image, x, top, w, h);
  } else if (failed) {
    // Rasterization gave up (repeated decode failures). Draw the raw source as plain text so
    // the content is at least readable — never leave a permanent grey blob.
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${stroke.fontSize}px Nunito, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    stroke.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, x, top + i * stroke.fontSize * 1.2);
    });
    ctx.restore();
  } else {
    // Faint placeholder so a big formula doesn't flash empty before its raster decodes.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x, top, w, h);
    ctx.restore();
  }
}

/**
 * Render an image object onto the canvas. The decoded HTMLImageElement lives in imageCache
 * (keyed by src), never on the object. `atX/atY` let move-previews draw at an offset.
 * Placeholder while decoding; a "broken image" outline if the data URI fails to decode.
 */
function renderImageObject(ctx, stroke, triggerRedraw, atX, atY) {
  if (!stroke.src) return;
  const x = atX ?? stroke.x;
  const y = atY ?? stroke.y;
  const { width, height } = stroke;
  const { image, ready, failed } = getImage(stroke.src, triggerRedraw);

  if (ready && image) {
    ctx.drawImage(image, x, y, width, height);
  } else if (failed) {
    // Un-decodable src: a thin outlined box with an X so it's visibly broken, not silently gone.
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 60, 60, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + width, y + height);
    ctx.moveTo(x + width, y); ctx.lineTo(x, y + height);
    ctx.stroke();
    ctx.restore();
  } else {
    // Faint placeholder during the brief decode window.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }
}

export function useCanvasRenderer({
  canvasRef,
  viewport,
  drawCallback,
  drawGrid,
  canvasHelpers,
  redrawCallbackRef, // set by useDraw to redrawCanvas; used to repaint when a text raster decodes
  // Stroke refs
  allStrokesRef,
  ongoingStrokeRef,
  selectedStrokeIdsRef,
  selectionRectRef,
  hoveredStrokeRef,
  // Mode state refs
  isSelecting,
  isMoving,
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
  getCombinedBoundingBox,
  // Transform utilities
  translatePoints,
  drawResizeHandles,
  drawRotationHandle,
  drawDeleteHandle,
  computeBoundingBox,
}) {
  const { textDraftRef, textCreationRef, notifyCanvasChange } = useCanvasContext();
  const redrawCanvas = useCallback(() => {
    notifyCanvasChange();
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

    // Repaint hook for async text rasters: when a KaTeX/Markdown image finishes
    // decoding, the cache calls this to redraw the frame with the crisp raster.
    const triggerRedraw = () => redrawCallbackRef?.current?.();

    // Step 4: Draw grid if enabled
    if (drawGrid) {
      drawGrid(ctx, canvas, currentZoom);
    }

    // Step 5 & 6: Draw all strokes and text from unified storage (exclude selected if moving)
    allStrokesRef.current.forEach((stroke) => {
      if (stroke.type === 'text') refreshTextBounds(stroke);
      else if (stroke.type === 'image') refreshImageBounds(stroke);
      if (textDraftRef.current?.object.id === stroke.id) return;
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
        // Draw text object as rendered Markdown/KaTeX raster
        renderTextObject(ctx, stroke, currentZoom, triggerRedraw);
      } else if (stroke.type === 'image') {
        // Draw image object (cached decoded raster)
        renderImageObject(ctx, stroke, triggerRedraw);
      } else if (stroke.points && Array.isArray(stroke.points)) {
        // Draw regular stroke
        const { points, config } = stroke;
        for (let i = 1; i < points.length; i++) {
          drawCallback(points[i - 1], points[i], ctx, config, currentZoom);
        }
      }
    });

    const draft = textDraftRef.current?.object;
    if (draft) {
      refreshTextBounds(draft);
      renderTextObject(ctx, draft, currentZoom, triggerRedraw);
    }
    const outline = textCreationRef.current || draft?.bbox;
    if (outline) {
      ctx.save();
      ctx.strokeStyle = '#f08080';
      ctx.lineWidth = 1 / currentZoom;
      ctx.setLineDash([5 / currentZoom, 4 / currentZoom]);
      ctx.strokeRect(outline.minX, outline.minY, outline.maxX - outline.minX, outline.maxY - outline.minY);
      ctx.restore();
    }

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
              if (stroke.type === 'text') {
                // Draw moved text at offset (reuses the cached raster, no re-render)
                renderTextObject(
                  ctx,
                  stroke,
                  currentZoom,
                  triggerRedraw,
                  stroke.x + currentMoveOffset.current.x,
                  stroke.y + currentMoveOffset.current.y
                );
              } else if (stroke.type === 'image') {
                // Draw moved image at offset (reuses the cached decode)
                renderImageObject(
                  ctx,
                  stroke,
                  triggerRedraw,
                  stroke.x + currentMoveOffset.current.x,
                  stroke.y + currentMoveOffset.current.y
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

              renderTextObject(
                ctx,
                textStroke,
                currentZoom,
                triggerRedraw,
                textStroke.x + currentMoveOffset.current.x,
                textStroke.y + currentMoveOffset.current.y
              );
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

        // Step 15: Draw resize, rotation, and delete handles on combined bbox
        drawResizeHandles(ctx, combinedBbox);
        drawRotationHandle(ctx, combinedBbox);
        drawDeleteHandle(ctx, combinedBbox);
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
    notifyCanvasChange, textCreationRef, textDraftRef,
    canvasHelpers,
    canvasRef,
    viewport,
    drawCallback,
    drawGrid,
      // Refs are stable and shouldn't be in deps, but keeping for linter
    redrawCallbackRef,
    allStrokesRef,
    ongoingStrokeRef,
    selectedStrokeIdsRef,
    selectionRectRef,
    hoveredStrokeRef,
    isSelecting,
    isMoving,
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
      getCombinedBoundingBox,
    translatePoints,
    drawResizeHandles,
    drawRotationHandle,
    drawDeleteHandle,
    computeBoundingBox,
  ]);

  return {
    redrawCanvas,
  };
}
