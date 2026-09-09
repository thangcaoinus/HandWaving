import { useCallback } from 'react';
import { downscaleToDataURL } from '../utils/imageDownscale';
import { generateUniqueId } from '../utils/idGenerator';
import { validImageState } from '../../../shared/imageObject';
import { logger } from '../utils/logger';

// Client-side storage heuristic. The TRUE limit is 100MB/user across ALL their canvases, enforced
// server-side on save — the client can't see other canvases, so this is a pragmatic up-front guard
// against the "pasted a giant image" case. Leaves headroom below 100MB for other canvases + overhead.
const CLIENT_STORAGE_BUDGET = 90 * 1024 * 1024;

// How big a fresh image may appear: fit within this fraction of the canvas viewport (in canvas px),
// preserving aspect ratio. Prevents a huge paste from filling the whole board.
const MAX_INITIAL_VIEWPORT_FRACTION = 0.6;

/**
 * Shared image-insertion logic for BOTH the toolbar button and the OS-clipboard paste listener.
 *
 * @param getOperationManager () => the operation manager (may return null pre-init)
 * @param allStrokesRef the unified object Map (for the storage pre-check)
 * @param viewport the viewport context (screenToCanvas + zoom)
 * @param canvasRef ref to the <canvas> (for center placement)
 * @param onError optional (message) => void — caller shows an AlertModal
 */
export function useImageInsert(getOperationManager, allStrokesRef, viewport, canvasRef, onError = null) {
  const fail = useCallback((message) => {
    logger.warn('🖼️ image insert rejected:', message);
    if (onError) onError(message);
  }, [onError]);

  // Place a decoded image (dataURL + intrinsic w/h) centered at a canvas-space point, or the
  // viewport center if none given. Runs the storage pre-check, then commits one IMAGE_ADD.
  const commitImage = useCallback((dataURL, naturalW, naturalH, centerCanvasPoint) => {
    const opManager = getOperationManager();
    if (!opManager) { fail('Canvas is not ready yet — try again in a moment.'); return false; }

    // Storage pre-check: current canvas + this image must fit the client budget.
    let currentSize = 0;
    try {
      const objs = Array.from(allStrokesRef.current.values()).filter(s => !s.isTemporary);
      currentSize = JSON.stringify(objs).length;
    } catch { /* size estimate is best-effort */ }
    if (currentSize + dataURL.length > CLIENT_STORAGE_BUDGET) {
      fail('This image would exceed the canvas storage limit. Try a smaller image.');
      return false;
    }

    // Fit the image within a fraction of the viewport (canvas-space), preserving aspect ratio.
    const canvas = canvasRef.current;
    const zoom = viewport.getCurrentZoom?.() || 1;
    let width = naturalW;
    let height = naturalH;
    if (canvas) {
      const maxW = (canvas.width / zoom) * MAX_INITIAL_VIEWPORT_FRACTION;
      const maxH = (canvas.height / zoom) * MAX_INITIAL_VIEWPORT_FRACTION;
      const fit = Math.min(1, maxW / naturalW, maxH / naturalH);
      width = Math.max(1, Math.round(naturalW * fit));
      height = Math.max(1, Math.round(naturalH * fit));
    }

    // Placement: given center, else the viewport center in canvas coords.
    let cx, cy;
    if (centerCanvasPoint) {
      cx = centerCanvasPoint.x;
      cy = centerCanvasPoint.y;
    } else if (canvas && viewport.screenToCanvas) {
      const c = viewport.screenToCanvas(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
      cx = c.x; cy = c.y;
    } else {
      cx = 0; cy = 0;
    }
    const x = cx - width / 2;
    const y = cy - height / 2;

    const id = generateUniqueId('image');
    const payload = { src: dataURL, x, y, width, height, config: null, attachedTo: null };
    if (!validImageState(payload)) { fail('That image could not be added (invalid data).'); return false; }

    opManager.addImage(id, dataURL, x, y, width, height, null, null);
    logger.log('🖼️ inserted image', id, `${width}x${height}`, 'at', x, y);
    return id;
  }, [getOperationManager, allStrokesRef, viewport, canvasRef, fail]);

  // Entry from a File/Blob (toolbar file picker OR a clipboard image blob).
  const insertImageFromBlob = useCallback(async (fileOrBlob, centerCanvasPoint = null) => {
    try {
      const { dataURL, width, height } = await downscaleToDataURL(fileOrBlob);
      return commitImage(dataURL, width, height, centerCanvasPoint);
    } catch (err) {
      fail(err?.message || 'Could not read that image.');
      return false;
    }
  }, [commitImage, fail]);

  return { insertImageFromBlob };
}
