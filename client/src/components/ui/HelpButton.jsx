import React, { useState } from "react";
import { Keyboard, X } from 'lucide-react';

export default function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { keys: ["Ctrl", "Z"], description: "Undo last action" },
    { keys: ["Ctrl", "Y"], description: "Redo last action" },
    { keys: ["Ctrl", "A"], description: "Select all objects" },
    { keys: ["Ctrl", "Click"], description: "Add/remove object from selection" },
    { keys: ["Ctrl", "Drag"], description: "Pan canvas" },
    { keys: ["Ctrl", "Scroll"], description: "Zoom in/out" },
    { keys: ["Delete"], description: "Delete selected objects" },
    { keys: ["Backspace"], description: "Delete selected objects" },
    { keys: ["Escape"], description: "Cancel lasso selection" },
  ];

  return (
    <>
      {/* Help Button */}
      <div className="fixed bottom-4 left-4 z-10">
        <button
          className="w-10 h-10 paper-card hover:brightness-[0.97] rounded-full shadow-lg flex items-center justify-center transition-all text-xl font-display font-bold text-[color:var(--coral)]"
          onClick={() => setIsOpen(!isOpen)}
          title="Keyboard Shortcuts"
        >
          ?
        </button>
      </div>

      {/* Shortcuts Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50">
            <div className="paper-card sketch-panel overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, var(--coral), var(--coral-deep))' }}>
                <h3 className="font-display text-white text-xl flex items-center gap-2">
                  <Keyboard className="w-5 h-5" />
                  <span>Keyboard Shortcuts</span>
                </h3>
                <button
                  className="text-white hover:bg-white/20 rounded px-2 py-1 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] last:border-0"
                    >
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-2 py-1 rounded text-xs font-mono font-semibold text-[color:var(--ink)] bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--ink)_18%,transparent)]">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-[color:var(--ink-soft)] mx-1">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <span className="text-sm text-[color:var(--ink-soft)] ml-4">
                        {shortcut.description}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Additional Tips */}
                <div className="mt-6 p-4 rounded-lg bg-[color:color-mix(in_srgb,var(--coral)_10%,var(--paper))] border border-[color:color-mix(in_srgb,var(--coral)_25%,transparent)]">
                  <h4 className="font-display text-sm text-[color:var(--coral-deep)] mb-2">
                    💡 Tips
                  </h4>
                  <ul className="text-xs text-[color:var(--ink-soft)] space-y-1">
                    <li>• Use lasso selection for freeform object selection</li>
                    <li>• Drag resize handles to scale selected objects</li>
                    <li>• Drag rotation handle (green) to rotate objects</li>
                    <li>
                      • Click inside selection box to move multiple objects
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
