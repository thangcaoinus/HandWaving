// Shared image-object model — used by BOTH the browser and the server (mirrors textBox.js).
// An image object is the third canvas type alongside strokes (.points) and text (x/y + textBox).
// Shape: { id, type:'image', x, y, width, height, src (data URI), bbox, userId, username, attachedTo }

// Data-URI length cap. A downscaled 1600px WebP lands well under this; the ceiling is a DoS guard
// so a peer can't shove a multi-MB base64 blob through the socket. ~12MB of base64 ≈ 9MB decoded.
export const IMAGE_SRC_MAX_LEN = 12_000_000;

export const MIN_IMAGE_DIM = 1;
export const MAX_IMAGE_DIM = 20000;

// Images may carry no config at all; if present, only an optional hex color is meaningful today.
export function validImageConfig(config) {
  if (config == null) return true;
  if (typeof config !== 'object') return false;
  if (config.color !== undefined && !/^#[\da-f]{6}$/i.test(config.color)) return false;
  return true;
}

export function validImageState(state) {
  return !!state &&
    typeof state.src === 'string' && state.src.startsWith('data:image/') && state.src.length <= IMAGE_SRC_MAX_LEN &&
    ['x', 'y'].every(k => Number.isFinite(state[k]) && Math.abs(state[k]) < 1_000_000) &&
    ['width', 'height'].every(k => Number.isFinite(state[k]) && state[k] >= MIN_IMAGE_DIM && state[k] <= MAX_IMAGE_DIM) &&
    validImageConfig(state.config);
}

// Exact comparable/persisted fields, deep-cloned config — parallels textState().
export function imageState(stroke) {
  return { src: stroke.src, x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height,
    config: stroke.config ? structuredClone(stroke.config) : undefined };
}
