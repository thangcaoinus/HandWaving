import { renderToHtml, TEXT_CONTENT_CSS, KATEX_RASTER_CSS } from './markdownRenderer';
import { getRenderedSize, getTextLayout, textLayoutCss } from './textBbox';

/**
 * Rasterization + caching engine for Markdown/KaTeX text objects.
 *
 * The canvas is a 2D context and cannot draw KaTeX (HTML/SVG) directly, so we render
 * source -> HTML -> an <svg><foreignObject> -> an <img> (via a data: URI) and cache
 * the decoded HTMLImageElement. The render loop then ctx.drawImage's it.
 *
 * Async story: getTextImage returns synchronously. On a cache miss it kicks off an
 * async image load and returns { ready:false } with a measured w/h so the caller can
 * draw a placeholder; when the image decodes, onReady() (the global redraw) repaints
 * and the same key now resolves ready -> no new work -> loop terminates.
 */

// Zoom buckets: we rasterize at a supersampled size per bucket so zooming in stays
// crisp without re-rasterizing on every wheel tick.
const ZOOM_BUCKETS = [0.5, 1, 2, 4];
const MAX_CACHE = 300;
const RASTER_DEBOUNCE_MS = 150;
const MAX_RASTER_RETRIES = 2; // transient decode hiccups recover; beyond this, fall back to raw text
const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

export function snapZoom(zoom) {
  // pick the smallest bucket >= zoom, clamp to the top bucket
  for (const b of ZOOM_BUCKETS) {
    if (zoom <= b) return b;
  }
  return ZOOM_BUCKETS[ZOOM_BUCKETS.length - 1];
}

// key -> { image, w, h, ready, pending, timer }
const cache = new Map();

function makeKey({ text, fontSize, color, zoomBucket, box }) {
  return JSON.stringify([zoomBucket, fontSize, color, box, text]);
}

function touch(key, entry) {
  // LRU: re-insert to move to the end
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Build the SVG data URI. Everything (CSS, fonts via KaTeX's own @font-face already
 * loaded on the page) is inlined so the export canvas stays untainted — no external
 * url() references.
 */
function buildSvgDataUri(html, w, h, fontSize, color, box = null, zoomBucket = 1) {
  // Keep the HTML at its wrapping width while giving its raster room for overflow.
  // Bound bitmap allocation independently from canvas-space dimensions.
  const scale = Math.min(DPR * zoomBucket, 8192 / w, 8192 / h, Math.sqrt(16000000 / (w * h)));
  const pxW = Math.max(1, Math.ceil(w * scale));
  const pxH = Math.max(1, Math.ceil(h * scale));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${w} ${h}">` +
      `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml">` +
          `<style>${KATEX_RASTER_CSS}${TEXT_CONTENT_CSS}</style>` +
          `<div class="hw-md" style="${textLayoutCss(fontSize, box)}color:${color};">` +
            html +
          `</div>` +
        `</div>` +
      `</foreignObject>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// XML 1.0 forbids most control chars (NUL etc.); they make the SVG undecodable -> onerror.
// Strip them before rendering so valid content never lands in the retry/fallback path.
// Keeps \x09 (tab), \x0A (LF), \x0D (CR) — the only control chars XML permits.
// eslint-disable-next-line no-control-regex
const XML_ILLEGAL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
function stripXmlIllegal(s) {
  return typeof s === 'string' ? s.replace(XML_ILLEGAL, '') : s;
}

function startRaster(key, entry, params, onReady) {
  const { text, fontSize, color, box, zoomBucket } = params;
  const html = renderToHtml(stripXmlIllegal(text)) || '&#8203;';
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    entry.image = img;
    entry.ready = true;
    entry.pending = false;
    // Defer the repaint to coalesce multiple images loading in the same tick and to
    // avoid re-entering a redraw synchronously from within img.onload.
    if (typeof onReady === 'function') {
      if (typeof queueMicrotask === 'function') queueMicrotask(onReady);
      else Promise.resolve().then(onReady);
    }
  };
  img.onerror = () => {
    // A decode failure must NOT poison the key as a permanent grey blob (a cached not-ready
    // entry every redraw hits and never rebuilds). We KEEP the entry so errorCount survives
    // across retries — deleting it would reset the count and thrash the decoder forever on a
    // genuinely un-rasterizable input (e.g. raw control chars, invalid in SVG/XML).
    entry.pending = false;
    entry.errorCount = (entry.errorCount || 0) + 1;
    const repaint = () => {
      if (typeof onReady !== 'function') return;
      if (typeof queueMicrotask === 'function') queueMicrotask(onReady);
      else Promise.resolve().then(onReady);
    };
    if (entry.errorCount >= MAX_RASTER_RETRIES) {
      // Give up: mark failed so the renderer draws a readable raw-text fallback, not grey.
      entry.failed = true;
      repaint();
    } else {
      // Transient? Re-arm a debounced retry on the SAME entry (count preserved).
      scheduleRaster(key, entry, params, onReady);
      repaint();
    }
  };
  img.src = buildSvgDataUri(html, entry.w, entry.h, fontSize, color, box, zoomBucket);
}

/**
 * Get a cached rendered image for a text object.
 * @param params { text, fontSize, color, zoom }
 * @param onReady called (deferred) when a freshly-built image finishes decoding
 * @returns { image, w, h, ready }
 */
// Schedule a debounced raster build for an entry that isn't ready. Idempotent: a build
// already in flight (timer pending, or img decoding) is left alone.
function scheduleRaster(key, entry, params, onReady) {
  if (entry.ready || entry.pending || entry.failed) return;
  entry.pending = true;
  entry.timer = setTimeout(() => {
    entry.timer = null;
    // Guard: entry may have been evicted while waiting. If so, drop the pending flag on
    // the orphan (harmless) and bail — the next getTextImage will re-miss and rebuild.
    if (cache.get(key) !== entry) {
      entry.pending = false;
      return;
    }
    startRaster(key, entry, params, onReady);
  }, RASTER_DEBOUNCE_MS);
}

export function getTextImage(params, onReady) {
  const { text, color, zoom = 1, config = {} } = params;
  const layout = getTextLayout(text, params.fontSize, config);
  const fontSize = layout.effectiveFontSize;
  const box = config.textBox;
  const zoomBucket = snapZoom(zoom);
  const key = makeKey({ text, fontSize, color, zoomBucket, box });

  const existing = cache.get(key);
  if (existing) {
    touch(key, existing);
    // A hit that's neither ready nor actively building (and hasn't permanently failed) is
    // STUCK — e.g. its timer was orphaned by an eviction. Restart it, or the render loop
    // draws the grey placeholder for this key forever.
    if (!existing.ready && !existing.pending && !existing.failed) {
      scheduleRaster(key, existing, { text, fontSize, color, zoomBucket, box }, onReady);
    }
    return {
      image: existing.image,
      w: existing.w,
      h: existing.h,
      ready: existing.ready,
      failed: !!existing.failed,
    };
  }

  // Miss: measure synchronously so the caller can size a placeholder immediately.
  const { w, h } = layout;
  const entry = { image: null, w, h, ready: false, pending: false, timer: null };
  touch(key, entry);

  // Debounce the actual raster build so rapid typing doesn't thrash the decoder.
  scheduleRaster(key, entry, { text, fontSize, color, zoomBucket, box }, onReady);

  return { image: null, w, h, ready: false };
}

/**
 * For export: synchronously request rasters at a fixed high bucket and await all of
 * them (bypassing the debounce for immediacy). Resolves once every text object has a
 * decoded image (or errored). Safe to call with a mix of already-cached and new keys.
 */
export function ensureTextRastersReady(strokes, zoomBucket = 2) {
  const texts = [];
  strokes.forEach((s) => {
    if (s && s.type === 'text' && s.text) texts.push(s);
  });
  if (texts.length === 0) return Promise.resolve();

  return Promise.all(
    texts.map(
      (s) =>
        new Promise((resolve) => {
          const color = (s.config && s.config.color) || '#000000';
          const key = makeKey({ text: s.text, fontSize: s.fontSize, color, zoomBucket });
          const existing = cache.get(key);
          if (existing && existing.ready) return resolve();

          const { w, h } = getRenderedSize(s.text, s.fontSize);
          const entry = existing || { image: null, w, h, ready: false, pending: false, timer: null };
          entry.w = w;
          entry.h = h;
          touch(key, entry);

          const html = renderToHtml(stripXmlIllegal(s.text)) || '&#8203;';
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            entry.image = img;
            entry.ready = true;
            entry.pending = false;
            resolve();
          };
          img.onerror = () => {
            entry.pending = false;
            resolve(); // don't hang the export on one bad glyph
          };
          img.src = buildSvgDataUri(html, w, h, s.fontSize, color);
        })
    )
  );
}

/**
 * Read a cached image without triggering a build. Used by the export draw pass after
 * ensureTextRastersReady has warmed the cache. Returns null if not ready.
 */
export function peekTextImage(text, fontSize, color, zoomBucket = 2) {
  const key = makeKey({ text, fontSize, color, zoomBucket });
  const entry = cache.get(key);
  if (entry && entry.ready) return { image: entry.image, w: entry.w, h: entry.h };
  return null;
}

export function clearTextRasterCache() {
  cache.forEach((e) => e.timer && clearTimeout(e.timer));
  cache.clear();
}

if (typeof window !== 'undefined') window.addEventListener('text-fonts-ready', clearTextRasterCache);
