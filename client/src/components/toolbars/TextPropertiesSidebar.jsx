import React, { useState, useEffect } from 'react';
import { Type } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { useCanvasContext, useCanvasSnapshot } from '../../contexts/CanvasContext';
import { useCanvasPersistence } from '../../contexts/CanvasPersistenceContext';
import { ensureTextBox, refreshTextBounds } from '../../utils/textBbox';
import { DEFAULT_TEXT_BOX, textState } from '../../../../shared/textBox';

function NumberField({ label, value, min, max, step = 1, onCommit }) {
  const [input, setInput] = useState(value ?? '');
  useEffect(() => setInput(value ?? ''), [value]);
  const commit = () => {
    const number = Number(input);
    if (input === '' || !Number.isFinite(number)) { setInput(value ?? ''); return; }
    const next = Math.max(min, Math.min(max, number));
    setInput(next);
    if (next !== value) onCommit(next);
  };
  return <label className="block text-xs font-semibold">{label}
    <input aria-label={label} type="number" min={min} max={max} step={step} value={input} placeholder="Mixed"
      onChange={e => setInput(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="w-full mt-1 rounded border p-1.5 bg-white text-[color:var(--ink)]" />
  </label>;
}

export default function TextPropertiesSidebar() {
  const { textDefaults, setTextDefaults } = useAppState();
  const { texts, draft } = useCanvasSnapshot();
  const { textDraftRef, operationManagerRef, redrawRef, notifyCanvasChange } = useCanvasContext();
  const { canEdit } = useCanvasPersistence();
  const objects = draft ? [draft.object] : texts;
  const selected = objects.map(s => ensureTextBox(structuredClone(s)));
  const defaults = { ...DEFAULT_TEXT_BOX, ...textDefaults.textBox, fontSize: textDefaults.fontSize, color: textDefaults.color };
  const getValue = key => {
    if (!selected.length) return defaults[key];
    const values = selected.map(s => key === 'fontSize' ? s.fontSize : key === 'color' ? s.config.color : s.config.textBox[key]);
    return values.every(v => v === values[0]) ? values[0] : undefined;
  };
  const update = patch => {
    if (!canEdit) return;
    if (!selected.length) {
      const { fontSize, color, ...box } = patch;
      setTextDefaults(prev => ({ ...prev, ...(fontSize === undefined ? {} : { fontSize }), ...(color === undefined ? {} : { color }),
        textBox: { ...DEFAULT_TEXT_BOX, ...prev.textBox, ...box } }));
      return;
    }
    const changes = selected.map(s => {
      const { fontSize, color, ...box } = patch;
      if (fontSize !== undefined) { s.y += fontSize - s.fontSize; s.fontSize = fontSize; }
      if (color !== undefined) s.config.color = color;
      Object.assign(s.config.textBox, box);
      refreshTextBounds(s);
      return { textId: s.id, after: textState(s), object: s };
    });
    if (textDraftRef.current) {
      textDraftRef.current.object = changes[0].object;
      notifyCanvasChange();
      redrawRef.current?.();
    } else {
      operationManagerRef.current?.updateTexts(changes);
    }
  };
  const choice = (label, key, options) => <label className="block text-xs font-semibold">{label}
    <select aria-label={label} value={getValue(key) ?? ''} onChange={e => update({ [key]: e.target.value })}
      className="mt-1 w-full border rounded p-1.5 bg-white text-[color:var(--ink)]">
      <option value="" disabled>Mixed</option>
      {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </select>
  </label>;
  return <aside data-text-edit-session aria-label="Text properties" className="fixed left-4 top-24 w-56 paper-card sketch-panel border-2 p-3 z-10 overflow-y-auto text-[color:var(--ink)]"
    style={{ width: 224, maxHeight: 'calc(100dvh - 120px)' }} onKeyDown={e => {
      e.stopPropagation();
      if (e.key === 'Escape' && textDraftRef.current) {
        textDraftRef.current = null;
        notifyCanvasChange();
        redrawRef.current?.();
      }
    }}>
    <div className="flex items-center gap-2 border-b border-dashed pb-2 mb-2">
      <Type size={16} /><h3 className="font-display text-lg">{selected.length ? 'Text properties' : 'New text box'}</h3>
    </div>
    <p className="text-xs text-[color:var(--ink-soft)] mb-3">{selected.length > 1 ? `${selected.length} text boxes selected` : selected.length ? 'Applies to the whole text box' : 'Drag on the canvas to create a box'}</p>
    <fieldset disabled={!canEdit} className="space-y-3 disabled:opacity-60">
      <NumberField label="Font size" value={getValue('fontSize')} min={8} max={200} onCommit={v => update({ fontSize: v })} />
      <div className="flex gap-1 flex-wrap">{[16, 24, 32, 48].map(size => <button key={size} className="sketch-button px-2 py-1 text-xs" onClick={() => update({ fontSize: size })}>{size}</button>)}</div>
      <div className="flex gap-2">{[['bold', 'Bold'], ['italic', 'Italic']].map(([key, label]) => <button key={key} aria-pressed={getValue(key) ?? 'mixed'}
        className="sketch-button flex-1 py-1 border" style={{ background: getValue(key) ? 'var(--coral)' : undefined }} onClick={() => update({ [key]: !getValue(key) })}>{label}</button>)}</div>
      <label className="block text-xs font-semibold">Text color
        <input aria-label="Text color" type="color" defaultValue={getValue('color') || '#000000'} key={getValue('color') || 'mixed'}
          onBlur={e => { if (e.target.value !== getValue('color')) update({ color: e.target.value }); }} className="w-full h-8 mt-1 cursor-pointer" />
      </label>
      <div className="flex justify-between">{['#000000', '#EF4444', '#F97316', '#22C55E', '#3B82F6', '#A855F7'].map(color => <button key={color} aria-label={`Text color ${color}`} onClick={() => update({ color })} className="w-6 h-6 rounded border" style={{ background: color }} />)}</div>
      {choice('Alignment', 'align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])}
      {choice('Vertical alignment', 'verticalAlign', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}
      {choice('Fit text', 'fit', [['overflow', 'Overflow'], ['grow', 'Grow height'], ['shrink', 'Shrink to fit']])}
      <p className="text-xs text-[color:var(--ink-soft)]">{getValue('fit') === 'shrink' ? 'Shrinks the whole block, down to 8. The chosen font size is its ceiling.' : getValue('fit') === 'grow' ? 'Height follows the content; width stays fixed.' : 'Wraps at the box width. Extra text stays visible below.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Line spacing" value={getValue('lineHeight')} min={1} max={3} step={0.1} onCommit={v => update({ lineHeight: v })} />
        <NumberField label="Padding" value={getValue('padding')} min={0} max={64} onCommit={v => update({ padding: v })} />
      </div>
    </fieldset>
  </aside>;
}
