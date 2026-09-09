/**
 * Decode + cache engine for image objects — the much simpler cousin of textRasterCache.
 *
 * An image object's `src` is already a raster (data URI), so there's no source->HTML->SVG pipeline:
 * we just decode it into an HTMLImageElement once and ctx.drawImage it. The decoded element is kept
 * ONLY here (keyed by src), never on the stroke object — so the object stays JSON-serializable.
 *
 * Async story mirrors getTextImage: getImage returns synchronously; on a miss it kicks off decode and
 * returns { ready:false } so the caller draws a placeholder; onReady() (the global redraw) fires when
 * the image decodes, the next redraw hits the now-ready entry, and the loop terminates.
 */

const MAX_CACHE = 200;

// src -> { image, w, h, ready, pending, failed }
const cache = new Map();

function touch(key, entry) {
  // LRU: re-insert to move to the end; evict the oldest past the cap.
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function deferRepaint(onReady) {
  if (typeof onReady !== 'function') return;
  if (typeof queueMicrotask === 'function') queueMicrotask(onReady);
  else Promise.resolve().then(onReady);
}

function startDecode(entry, src, onReady) {
  const img = new Image();
  img.decoding = 'async';
  // A `done` promise on the entry lets ensureImagesReady await the SAME decode instead of starting
  // a second one. Resolves (never rejects) on both load and error so a bad image can't hang callers.
  entry.done = new Promise(resolve => {
    img.onload = () => {
      entry.image = img;
      entry.w = img.naturalWidth;
      entry.h = img.naturalHeight;
      entry.ready = true;
      entry.pending = false;
      deferRepaint(onReady);
      resolve();
    };
    img.onerror = () => {
      // A data URI that won't decode won't decode on retry either — no retry loop, just mark failed
      // so the renderer draws a broken-image placeholder instead of hitting this entry forever.
      entry.pending = false;
      entry.failed = true;
      deferRepaint(onReady);
      resolve();
    };
  });
  img.src = src;
}

/**
 * Get a decoded image for an image object's src.
 * @param src the data URI
 * @param onReady called (deferred) when a freshly-decoded image is ready — the global redraw
 * @returns { image, w, h, ready, failed }
 */
export function getImage(src, onReady) {
  if (!src) return { image: null, w: 0, h: 0, ready: false, failed: true };

  let entry = cache.get(src);
  if (entry) {
    touch(src, entry);
    return { image: entry.image, w: entry.w, h: entry.h, ready: !!entry.ready, failed: !!entry.failed };
  }

  entry = { image: null, w: 0, h: 0, ready: false, pending: true, failed: false };
  touch(src, entry);
  startDecode(entry, src, onReady);
  return { image: null, w: 0, h: 0, ready: false, failed: false };
}

// Export support: read-only peek (no decode kicked off) — used after ensureImagesReady.
export function peekImage(src) {
  const entry = cache.get(src);
  return entry && entry.ready ? { image: entry.image, w: entry.w, h: entry.h } : null;
}

// Export support: decode every image object up front and resolve when all are ready-or-failed
// (mirror of ensureTextRastersReady). Failures resolve too so a bad image can't hang an export.
export function ensureImagesReady(strokes) {
  const images = (strokes || []).filter(s => s.type === 'image' && s.src);
  return Promise.all(images.map(s => {
    const res = getImage(s.src, null); // kicks off decode on a miss, populating entry.done
    if (res.ready || res.failed) return Promise.resolve();
    return cache.get(s.src)?.done ?? Promise.resolve();
  }));
}

export function clearImageCache() { cache.clear(); }
