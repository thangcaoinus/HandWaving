import { MIN_IMAGE_DIM, MAX_IMAGE_DIM } from '../../../shared/imageObject';

// Image bbox helpers — the image analog of textBbox's refreshTextBounds/resizeTextBox.
// Unlike text, an image's (x,y) is its plain top-left corner (no baseline/fontSize offset),
// so the bbox derives directly from x/y/width/height.

// Recompute and stamp the bbox in place; returns the stroke so callers can chain like text does.
// Load/creation MUST call this so the "image always carries a valid bbox" invariant holds — several
// hit-test fallbacks do computeBoundingBox(stroke.points), which is null for an image.
export function refreshImageBounds(stroke) {
  stroke.bbox = { minX: stroke.x, maxX: stroke.x + stroke.width, minY: stroke.y, maxY: stroke.y + stroke.height };
  return stroke;
}

// Resize the box against a fixed anchor (opposite corner/edge). Same anchor-relative math as
// resizeTextBox but applied straight to width/height — no textBox/font indirection.
// Proportional-only enforcement lives at the transform layer (uniform scaleX/scaleY get passed in).
export function resizeImageBox(stroke, scaleX, scaleY, anchor) {
  const x1 = anchor.x + (stroke.x - anchor.x) * scaleX;
  const x2 = anchor.x + (stroke.x + stroke.width - anchor.x) * scaleX;
  const y1 = anchor.y + (stroke.y - anchor.y) * scaleY;
  const y2 = anchor.y + (stroke.y + stroke.height - anchor.y) * scaleY;
  stroke.x = Math.min(x1, x2);
  stroke.y = Math.min(y1, y2);
  stroke.width = Math.min(MAX_IMAGE_DIM, Math.max(MIN_IMAGE_DIM, Math.abs(x2 - x1)));
  stroke.height = Math.min(MAX_IMAGE_DIM, Math.max(MIN_IMAGE_DIM, Math.abs(y2 - y1)));
  return refreshImageBounds(stroke);
}
