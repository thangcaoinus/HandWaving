import React, { useState, useEffect, useRef } from 'react';
import Modal from '../modals/Modal';

export default function TextInputModal({ isOpen, onClose, onSubmit, initialText = '', position = null }) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialText]);

  function handleSubmit(e) {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
      onClose();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialText ? "Edit Text" : "Add Text"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your text here..."
          className="sketch-input w-full min-h-[120px] resize-none"
          style={{ fontFamily: 'Comic Sans MS, cursive' }}
        />
        <div className="text-sm text-[color:var(--ink-soft)]">
          Press <kbd className="px-2 py-1 rounded text-[color:var(--ink)] bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--ink)_18%,transparent)]">Ctrl+Enter</kbd> to submit
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost focus-sketch !text-base !py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!text.trim()}
            className="btn-coral focus-sketch !text-base !py-2"
          >
            {initialText ? 'Update' : 'Add Text'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
