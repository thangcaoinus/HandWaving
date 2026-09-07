import { DEFAULT_TEXT_BOX } from '../../../shared/textBox';
import { renderToHtml, TEXT_WRAPPER_CSS, TEXT_CONTENT_CSS } from './markdownRenderer';

// Measure rendered Markdown/KaTeX synchronously; only raster decoding is async.
export const MIN_FONT = 8;
export const MAX_FONT = 200;

export function clampFont(f) {
  if (!Number.isFinite(f)) return MIN_FONT;
  return Math.min(MAX_FONT, Math.max(MIN_FONT, f));
}

let measurer = null;
let measurerContent = null;

/**
 * Lazily build one reusable offscreen measurer. Kept attached to the DOM (offscreen)
 * so layout is real; a detached node reports 0 sizes.
 */
function getMeasurer() {
  if (measurer) return { host: measurer, content: measurerContent };
  if (typeof document === 'undefined') return null; // SSR / non-DOM guard

  measurer = document.createElement('div');
  measurer.setAttribute('aria-hidden', 'true');
  measurer.style.cssText =
    'position:absolute; left:-99999px; top:0; visibility:hidden; ' +
    'pointer-events:none; contain:layout style; box-sizing:content-box;';

  // Inject the same per-element resets the rasterizer uses, so measured geometry
  // equals painted pixels.
  const style = document.createElement('style');
  style.textContent = TEXT_CONTENT_CSS;
  measurer.appendChild(style);

  measurerContent = document.createElement('div');
  measurerContent.className = 'hw-md';
  measurer.appendChild(measurerContent);

  document.body.appendChild(measurer);
  return { host: measurer, content: measurerContent };
}

// Painted dimensions include padding and any content overflowing the wrapping width.
export function getRenderedSize(text, fontSize, box = null) {
  const m = getMeasurer();
  if (!m) {
    // Fallback for non-DOM environments: rough estimate.
    const lines = (text || '').split('\n');
    return { w: Math.max(1, ...lines.map((l) => l.length)) * fontSize * 0.6, h: lines.length * fontSize * 1.2 };
  }

  m.content.style.cssText = textLayoutCss(fontSize, box);
  m.content.style.width = box ? `${box.width}px` : 'max-content';
  m.content.style.maxWidth = 'none';
  m.content.innerHTML = renderToHtml(text) || '&#8203;'; // zero-width space keeps empty box measurable

  // getBoundingClientRect() gives the true FRACTIONAL size; offsetWidth truncates to an
  // integer and can under-report a bold heading by <1px, which then clips in the raster.
  // Ceil so the raster canvas is always >= the content it must hold.
  const rect = m.content.getBoundingClientRect();
  return { w: Math.ceil(Math.max(rect.width, m.content.scrollWidth)), h: Math.ceil(Math.max(rect.height, m.content.scrollHeight)) };
}

// Shared by DOM measurement, editing preview, and the sealed SVG raster.
export function textLayoutCss(fontSize, box = null) {
  return TEXT_WRAPPER_CSS + `font-size:${fontSize}px;` + (box
    ? `width:${box.width}px;padding:${box.padding}px;line-height:${box.lineHeight};text-align:${box.align};font-weight:${box.bold ? 700 : 400};font-style:${box.italic ? 'italic' : 'normal'};overflow-wrap:anywhere;`
    : 'width:max-content;');
}

const layouts = new Map();
export function getTextLayout(text, fontSize, config = {}) {
  const box = config.textBox;
  const key = JSON.stringify([text, fontSize, box]);
  if (layouts.has(key)) return layouts.get(key);
  let effectiveFontSize = fontSize;
  let size = getRenderedSize(text, fontSize, box);
  if (box?.fit === 'shrink' && (size.h > box.height || size.w > box.width)) {
    let low = MIN_FONT, high = fontSize;
    for (let i = 0; i < 10; i++) {
      const mid = (low + high) / 2;
      const measured = getRenderedSize(text, mid, box);
      if (measured.h <= box.height && measured.w <= box.width) low = mid;
      else high = mid;
    }
    effectiveFontSize = Math.floor(low * 10) / 10;
    size = getRenderedSize(text, effectiveFontSize, box);
  }
  const width = box?.width ?? size.w;
  const height = box ? (box.fit === 'grow' ? size.h : box.height) : size.h;
  const spare = Math.max(0, height - size.h);
  const offsetY = box?.verticalAlign === 'middle' ? spare / 2 : box?.verticalAlign === 'bottom' ? spare : 0;
  const result = { width, height, w: size.w, h: size.h, offsetY, effectiveFontSize };
  layouts.set(key, result);
  if (layouts.size > 400) layouts.delete(layouts.keys().next().value);
  return result;
}

export function clearTextMeasurements() { layouts.clear(); }
if (typeof document !== 'undefined') {
  document.fonts?.addEventListener('loadingdone', () => {
    clearTextMeasurements();
    window.dispatchEvent(new Event('text-fonts-ready'));
  });
}

export function calculateTextBbox(text, x, y, fontSize, config = {}) {
  const { width, height } = getTextLayout(text, fontSize, config);
  return { minX: x, maxX: x + width, minY: y - fontSize, maxY: y - fontSize + height };
}

export function refreshTextBounds(stroke) {
  stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
  return stroke;
}

export function ensureTextBox(stroke) {
  if (!stroke.config?.textBox) {
    const { w, h } = getRenderedSize(stroke.text, stroke.fontSize);
    stroke.config = { ...stroke.config, textBox: { ...DEFAULT_TEXT_BOX,
      width: Math.max(16, Math.min(10000, w)), height: Math.max(16, Math.min(10000, h)), padding: 2, lineHeight: 1.2 } };
  }
  return refreshTextBounds(stroke);
}

export function textContainsPoint(stroke, point) {
  const l = getTextLayout(stroke.text, stroke.fontSize, stroke.config);
  const top = stroke.y - stroke.fontSize;
  return point.x >= stroke.x && point.x <= stroke.x + Math.max(l.width, l.w) &&
    point.y >= top && point.y <= top + Math.max(l.height, l.offsetY + l.h);
}

export function resizeTextBox(stroke, scaleX, scaleY, anchor) {
  ensureTextBox(stroke);
  const top = stroke.y - stroke.fontSize;
  const box = stroke.config.textBox;
  const x1 = anchor.x + (stroke.x - anchor.x) * scaleX;
  const x2 = anchor.x + (stroke.x + box.width - anchor.x) * scaleX;
  const y1 = anchor.y + (top - anchor.y) * scaleY;
  const y2 = anchor.y + (top + stroke.bbox.maxY - stroke.bbox.minY - anchor.y) * scaleY;
  stroke.x = Math.min(x1, x2);
  stroke.y = Math.min(y1, y2) + stroke.fontSize;
  stroke.config = { ...stroke.config, textBox: { ...box,
    width: Math.min(10000, Math.max(16, Math.abs(x2 - x1))),
    height: Math.min(10000, Math.max(16, Math.abs(y2 - y1))) } };
  return refreshTextBounds(stroke);
}
