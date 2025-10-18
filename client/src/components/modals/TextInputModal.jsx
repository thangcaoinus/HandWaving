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
          className="w-full min-h-[120px] p-3 border-2 border-gray-300 rounded-lg resize-none"
          style={{ fontFamily: 'Comic Sans MS, cursive' }}
        />
        <div className="text-sm text-gray-600" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
          Press <kbd className="px-2 py-1 bg-gray-200 rounded border border-gray-400">Ctrl+Enter</kbd> to submit
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="sketch-button px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!text.trim()}
            className="sketch-button px-4 py-2 bg-[#f08080] hover:bg-[#e07070] text-white border-2 border-[#d06060] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialText ? 'Update' : 'Add Text'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
