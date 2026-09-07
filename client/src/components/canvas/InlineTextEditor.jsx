import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { renderToHtml, TEXT_CONTENT_CSS } from '../../utils/markdownRenderer';
import { getTextLayout, textLayoutCss } from '../../utils/textBbox';

const InlineTextEditor = forwardRef(function InlineTextEditor({ object, x, y, zoom, conflict, onChange, onSubmit, onCancel }, ref) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const layout = getTextLayout(object.text, object.fontSize, object.config);
  useImperativeHandle(ref, () => ({ blur: () => onSubmit(false) }), [onSubmit]);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(object.text.length, object.text.length);
    // Focus once per editing session; formatting must preserve the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id]);
  useEffect(() => {
    if (previewRef.current) previewRef.current.style.cssText = textLayoutCss(layout.effectiveFontSize, object.config.textBox) + `color:${object.config.color};`;
  }, [object.config, layout.effectiveFontSize]);
  useEffect(() => {
    const outside = event => {
      if (!event.target.closest('[data-text-edit-session]') && event.target.tagName !== 'CANVAS') onSubmit(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [onSubmit]);
  const panelWidth = Math.min(340, window.innerWidth - 32);
  const panelX = Math.max(16, Math.min(window.innerWidth - panelWidth - 16, x + layout.width * zoom + 16));
  const panelY = Math.max(80, Math.min(window.innerHeight - 290, y));
  return <>
    <style>{TEXT_CONTENT_CSS}</style>
    <div aria-hidden="true" style={{ position: 'fixed', left: x, top: y, width: layout.width * zoom,
      height: layout.height * zoom, outline: '2px solid var(--coral)', pointerEvents: 'none', zIndex: 11 }}>
      <div style={{ position: 'absolute', top: layout.offsetY * zoom, transform: `scale(${zoom})`, transformOrigin: 'top left', background: 'var(--paper)' }}>
        <div ref={previewRef} className="hw-md" dangerouslySetInnerHTML={{ __html: renderToHtml(object.text) }} />
      </div>
    </div>
    <div data-text-edit-session className="paper-card sketch-panel border-2 border-[color:var(--coral)] p-3"
      style={{ position: 'fixed', left: panelX, top: panelY, width: panelWidth, zIndex: 30 }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(false); }
      }}>
      <label htmlFor="text-box-source" className="font-display text-lg">Text box</label>
      <p className="text-xs text-[color:var(--ink-soft)] mb-2">Markdown and $math$ · Preview on canvas</p>
      <textarea id="text-box-source" ref={inputRef} value={object.text} maxLength={10000}
        onChange={e => onChange(e.target.value)} spellCheck={false}
        className="w-full border rounded p-2 bg-white text-[color:var(--ink)]"
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, height: 150, resize: 'vertical' }} />
      {conflict ? <div role="alert" className="text-sm mt-2">
        <p>A collaborator changed this box while you were editing.</p>
        <button className="sketch-button p-2" onClick={() => onSubmit(true)}>Keep my version</button>
        <button className="sketch-button p-2" onClick={onCancel}>Use their version</button>
      </div> : <div className="flex justify-between items-center mt-2 text-xs">
        <span>Ctrl/⌘ + Enter to save</span>
        <button className="sketch-button px-3 py-1" onClick={() => onSubmit(false)}>Done</button>
      </div>}
    </div>
  </>;
});
export default InlineTextEditor;
