import React, { useState, useEffect } from 'react';
import { Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Palette } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { useCanvasContext, useCanvasSnapshot } from '../../contexts/CanvasContext';
import { useCanvasPersistence } from '../../contexts/CanvasPersistenceContext';
import { ensureTextBox, refreshTextBounds } from '../../utils/textBbox';
import { DEFAULT_TEXT_BOX, textState } from '../../../../shared/textBox';

// Shared design vocabulary — mirrors PropertiesSidebar (the pen tool) so the two panels read as one system.
const inkBorder = (pct) => `color-mix(in srgb, var(--ink) ${pct}%, transparent)`;

// Small uppercase section label with a coral dot bullet (matches the pen sidebar).
function SectionLabel({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-[color:var(--ink-soft)] mb-1 uppercase tracking-wide">
      {Icon
        ? <Icon size={10} className="text-[color:var(--ink-soft)]" strokeWidth={2.5} />
        : <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--coral)' }} />}
      {children}
    </span>
  );
}

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
  return (
    <label className="block">
      <SectionLabel>{label}</SectionLabel>
      <input aria-label={label} type="number" min={min} max={max} step={step} value={input} placeholder="Mixed"
        onChange={e => setInput(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="sketch-input text-sidebar-control min-w-0 text-sm" />
    </label>
  );
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

  const colorPresets = ['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
  const currentColor = getValue('color');

  // A segmented picker of icon buttons — replaces the plain <select> for align/verticalAlign,
  // matching the pen sidebar's tactile button rows. Falls back to text labels when no icon fits.
  const segmented = (label, icon, key, options) => (
    <div>
      <SectionLabel icon={icon}>{label}</SectionLabel>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([value, name, OptIcon]) => {
          const active = getValue(key) === value;
          return (
            <button key={value} type="button" aria-label={`${label}: ${name}`} aria-pressed={active} title={name}
              onClick={() => update({ [key]: value })}
              className={`sketch-button text-sidebar-control flex items-center justify-center gap-1 px-1 text-[10px] font-bold leading-none border-2 transition-all duration-150 ${
                active ? 'text-white shadow-sm sketch-active' : 'text-[color:var(--ink-soft)]'}`}
              style={active
                ? { backgroundColor: 'var(--coral)', borderColor: 'var(--coral-deep)' }
                : { backgroundColor: inkBorder(5), borderColor: inkBorder(15) }}>
              {OptIcon ? <OptIcon size={14} strokeWidth={2.5} /> : <span className="truncate">{name}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const fitValue = getValue('fit');
  const fitHint = fitValue === 'shrink'
    ? 'Shrinks the whole block, down to 8. The chosen font size is its ceiling.'
    : fitValue === 'grow'
      ? 'Height follows the content; width stays fixed.'
      : 'Wraps at the box width. Extra text stays visible below.';

  return (
    <aside data-text-edit-session aria-label="Text properties"
      className="text-properties-sidebar fixed left-4 top-24 paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] p-2.5 z-10 overflow-y-auto text-[color:var(--ink)]"
      style={{ width: 208, maxHeight: 'calc(100dvh - 120px)' }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape' && textDraftRef.current) {
          textDraftRef.current = null;
          notifyCanvasChange();
          redrawRef.current?.();
        }
      }}>
      {/* Header — coral icon + display title + dashed underline, exactly like the pen panel */}
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b-2 border-dashed border-[color:color-mix(in_srgb,var(--ink)_15%,transparent)]">
        <Type size={14} strokeWidth={2.5} style={{ color: 'var(--coral)' }} />
        <h3 className="font-display text-base text-[color:var(--ink)]">
          {selected.length ? 'Text' : 'New Text'}
        </h3>
      </div>
      <p className="text-[10px] leading-snug text-[color:var(--ink-soft)] mb-2">
        {selected.length > 1 ? `${selected.length} boxes selected` : selected.length ? 'Applies to the whole box' : 'Drag on the canvas to create a box'}
      </p>

      <fieldset disabled={!canEdit} className="space-y-1.5 disabled:opacity-60">
        {/* Font size and style share one row; presets sit directly underneath. */}
        <div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <NumberField label="Font size" value={getValue('fontSize')} min={8} max={200} onCommit={v => update({ fontSize: v })} />
            <div>
              <SectionLabel>Style</SectionLabel>
              <div className="flex gap-1">
                {[['bold', 'Bold', Bold], ['italic', 'Italic', Italic]].map(([key, label, icon]) => {
                  const Icon = icon;
                  const active = getValue(key);
                  return (
                    <button key={key} type="button" aria-label={label} aria-pressed={active ?? 'mixed'} title={label}
                      onClick={() => update({ [key]: !active })}
                      className={`sketch-button text-sidebar-control aspect-square flex items-center justify-center border-2 transition-all duration-150 ${
                        active ? 'text-white shadow-sm sketch-active' : 'text-[color:var(--ink-soft)]'}`}
                      style={active
                        ? { backgroundColor: 'var(--coral)', borderColor: 'var(--coral-deep)' }
                        : { backgroundColor: inkBorder(5), borderColor: inkBorder(15) }}>
                      <Icon size={14} strokeWidth={2.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1">
            {[16, 24, 32, 48].map(size => {
              const active = getValue('fontSize') === size;
              return (
                <button key={size} type="button" aria-pressed={active} onClick={() => update({ fontSize: size })}
                  className={`sketch-button text-sidebar-control px-2 text-[11px] font-bold border-2 transition-all duration-150 ${
                    active ? 'text-white shadow-sm sketch-active' : 'text-[color:var(--ink-soft)]'}`}
                  style={active
                    ? { backgroundColor: 'var(--coral)', borderColor: 'var(--coral-deep)' }
                    : { backgroundColor: inkBorder(5), borderColor: inkBorder(15) }}>
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color — preset grid + custom swatch, mirroring the pen panel's color section */}
        <div>
          <SectionLabel icon={Palette}>Color</SectionLabel>
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {colorPresets.map(color => {
              const active = (currentColor || '').toUpperCase() === color.toUpperCase();
              return (
                <button key={color} type="button" aria-label={`Text color ${color}`} aria-pressed={active} onClick={() => update({ color })}
                  className={`text-sidebar-control w-full rounded-md border-2 transition-all duration-150 hover:scale-110 hover:shadow-md ${
                    active ? 'shadow-md scale-105' : ''}`}
                  style={{ backgroundColor: color, borderColor: active ? 'var(--coral)' : inkBorder(15) }} />
              );
            })}
          </div>
          <div className="flex items-center gap-2 rounded-lg p-1 border-2"
            style={{ backgroundColor: inkBorder(5), borderColor: 'color-mix(in srgb, var(--coral) 35%, transparent)' }}>
            <input aria-label="Text color" type="color" defaultValue={currentColor || '#000000'} key={currentColor || 'mixed'}
              onBlur={e => { if (e.target.value !== currentColor) update({ color: e.target.value }); }}
              className="text-sidebar-control aspect-square rounded-md cursor-pointer border-2 border-white shadow-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-[color:var(--ink-soft)] font-semibold uppercase tracking-wide mb-0.5">Custom</div>
              <div className="text-[11px] text-[color:var(--ink)] font-mono font-bold truncate">
                {currentColor ? currentColor.toUpperCase() : 'Mixed'}
              </div>
            </div>
          </div>
        </div>

        {/* Alignment (horizontal + vertical) as icon segments */}
        <div className="pt-1 border-t-2 border-dashed border-[color:color-mix(in_srgb,var(--ink)_15%,transparent)] space-y-1.5">
          {segmented('Align', AlignLeft, 'align', [['left', 'Left', AlignLeft], ['center', 'Center', AlignCenter], ['right', 'Right', AlignRight]])}
          {segmented('Vertical', null, 'verticalAlign', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}
        </div>

        {/* Fit mode + contextual hint */}
        <div className="pt-1 border-t-2 border-dashed border-[color:color-mix(in_srgb,var(--ink)_15%,transparent)]">
          {segmented('Fit text', null, 'fit', [['overflow', 'Overflow'], ['grow', 'Grow'], ['shrink', 'Shrink']])}
          <p className="text-[10px] leading-snug text-[color:var(--ink-soft)] mt-1">{fitHint}</p>
        </div>

        {/* Spacing + padding */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t-2 border-dashed border-[color:color-mix(in_srgb,var(--ink)_15%,transparent)]">
          <NumberField label="Spacing" value={getValue('lineHeight')} min={1} max={3} step={0.1} onCommit={v => update({ lineHeight: v })} />
          <NumberField label="Padding" value={getValue('padding')} min={0} max={64} onCommit={v => update({ padding: v })} />
        </div>
      </fieldset>
    </aside>
  );
}
