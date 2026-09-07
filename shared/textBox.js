export const DEFAULT_TEXT_BOX = Object.freeze({
  width: 320, height: 120, fit: 'overflow', align: 'left', verticalAlign: 'top',
  padding: 8, lineHeight: 1.3, bold: false, italic: false,
});

export function validTextConfig(config) {
  if (!config || typeof config !== 'object' || !/^#[\da-f]{6}$/i.test(config.color)) return false;
  const box = config.textBox;
  if (!box) return true;
  return typeof box === 'object' &&
    ['width', 'height'].every(k => Number.isFinite(box[k]) && box[k] >= 16 && box[k] <= 10000) &&
    ['overflow', 'grow', 'shrink'].includes(box.fit) &&
    ['left', 'center', 'right'].includes(box.align) &&
    ['top', 'middle', 'bottom'].includes(box.verticalAlign) &&
    Number.isFinite(box.padding) && box.padding >= 0 && box.padding <= 64 &&
    Number.isFinite(box.lineHeight) && box.lineHeight >= 1 && box.lineHeight <= 3 &&
    typeof box.bold === 'boolean' && typeof box.italic === 'boolean';
}

export function validTextState(state) {
  return state && typeof state.text === 'string' && state.text.length <= 10000 &&
    ['x', 'y'].every(k => Number.isFinite(state[k]) && Math.abs(state[k]) < 1000000) &&
    Number.isFinite(state.fontSize) && state.fontSize >= 8 && state.fontSize <= 200 &&
    validTextConfig(state.config);
}

export function textState(stroke) {
  return { text: stroke.text, x: stroke.x, y: stroke.y, fontSize: stroke.fontSize,
    config: structuredClone(stroke.config) };
}
