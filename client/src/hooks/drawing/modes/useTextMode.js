import { useRef } from 'react';
import { generateUniqueId } from '../../../utils/idGenerator';
import { pointInBoundingBox } from '../../../utils/geometry';
import { refreshTextBounds, textContainsPoint } from '../../../utils/textBbox';
import { DEFAULT_TEXT_BOX } from '../../../../../shared/textBox';
import { useCanvasContext } from '../../../contexts/CanvasContext';

export function useTextMode({ canvasHelpers, onTextClick, allStrokesRef, canEdit, textDefaults, redrawCanvas }) {
  const { selectedStrokeIdsRef, textCreationRef, notifyCanvasChange } = useCanvasContext();
  const startRef = useRef(null);
  const shapeRef = useRef(null);
  const findText = point => [...allStrokesRef.current.values()].reverse().find(s => s.type === 'text' && textContainsPoint(s, point));
  const select = stroke => {
    selectedStrokeIdsRef.current.clear();
    selectedStrokeIdsRef.current.add(stroke.id);
    notifyCanvasChange();
    redrawCanvas();
  };
  const handleDoubleClick = e => {
    if (!canEdit) return { handled: false };
    const point = canvasHelpers.getCanvasPoint(e);
    const stroke = point && findText(point);
    if (!stroke) return { handled: false };
    select(stroke);
    onTextClick({ mode: 'edit', object: structuredClone(stroke) });
    return { handled: true };
  };
  const handleMouseDown = e => {
    if (!canEdit) return { handled: false };
    const point = canvasHelpers.getCanvasPoint(e);
    if (!point) return { handled: false };
    const stroke = findText(point);
    if (stroke) {
      select(stroke);
      return { handled: true };
    }
    selectedStrokeIdsRef.current.clear();
    startRef.current = point;
    shapeRef.current = [...allStrokesRef.current.values()].reverse().find(s => s.type !== 'text' && s.bbox && pointInBoundingBox(point, s.bbox));
    textCreationRef.current = { minX: point.x, maxX: point.x, minY: point.y, maxY: point.y };
    redrawCanvas();
    return { handled: true };
  };
  const handleMouseMove = e => {
    if (!startRef.current) return { handled: false };
    const p = canvasHelpers.getCanvasPoint(e);
    if (!p) return { handled: false };
    const a = startRef.current;
    textCreationRef.current = { minX: Math.min(a.x, p.x), maxX: Math.max(a.x, p.x), minY: Math.min(a.y, p.y), maxY: Math.max(a.y, p.y) };
    redrawCanvas();
    return { handled: true };
  };
  const cancelCreation = () => {
    startRef.current = null;
    textCreationRef.current = null;
    redrawCanvas();
  };
  const handleMouseUp = e => {
    if (!startRef.current) return { handled: false };
    if (e) handleMouseMove(e);
    const b = textCreationRef.current;
    const clicked = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) < 6;
    const shape = clicked ? shapeRef.current : null;
    if (shape) {
      const existing = [...allStrokesRef.current.values()].find(s => s.type === 'text' && s.attachedTo === shape.id);
      if (existing) {
        cancelCreation();
        select(existing);
        onTextClick({ mode: 'edit', object: structuredClone(existing) });
        return { handled: true };
      }
    }
    const fontSize = textDefaults.fontSize;
    const box = { ...DEFAULT_TEXT_BOX, ...textDefaults.textBox };
    let x = b.minX, top = b.minY;
    if (!clicked) {
      box.width = Math.min(10000, Math.max(16, b.maxX - b.minX));
      box.height = Math.min(10000, Math.max(16, b.maxY - b.minY));
    } else if (shape) {
      const w = shape.bbox.maxX - shape.bbox.minX, h = shape.bbox.maxY - shape.bbox.minY;
      x = shape.bbox.minX + w * 0.1;
      top = shape.bbox.minY + h * 0.1;
      box.width = Math.min(10000, Math.max(16, w * 0.8));
      box.height = Math.min(10000, Math.max(16, h * 0.8));
      box.align = 'center';
      box.verticalAlign = 'middle';
    }
    const object = refreshTextBounds({ id: generateUniqueId('text'), type: 'text', text: '', x, y: top + fontSize,
      fontSize, config: { color: textDefaults.color, textBox: box }, attachedTo: shape?.id || null });
    cancelCreation();
    select(object);
    onTextClick({ mode: 'add', object });
    return { handled: true };
  };
  return { handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, cancelCreation };
}
