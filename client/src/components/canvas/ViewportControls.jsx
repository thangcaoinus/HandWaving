import React from "react";
import { useViewportContext } from "../../contexts/ViewportContext";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { Undo2, Redo2, ZoomIn, ZoomOut, Home } from "lucide-react";

export default function ViewportControls() {
  const { viewport } = useViewportContext();
  const { handleUndo, handleRedo } = useCanvasContext();
  const { canEdit } = useCanvasPersistence();

  return (
    <div className="fixed bottom-4 right-4 flex gap-3 z-10">
      {/* Undo/Redo Panel - only show if can edit */}
      {canEdit && (
        <div className="paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] px-2.5 py-2.5 flex gap-2 items-center">
          <button
            className="w-8 h-8 bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)] text-[color:var(--ink-soft)] hover:text-[color:var(--coral)] sketch-button transition-all duration-150 flex items-center justify-center border-2 border-transparent active:translate-y-0"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} strokeWidth={2.5} />
          </button>
          <button
            className="w-8 h-8 bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)] text-[color:var(--ink-soft)] hover:text-[color:var(--coral)] sketch-button transition-all duration-150 flex items-center justify-center border-2 border-transparent active:translate-y-0"
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Zoom Controls Panel */}
      <div className="paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] px-2.5 py-2.5 flex gap-2 items-center">
        <button
          className="w-8 h-8 text-white sketch-button transition-all duration-150 flex items-center justify-center active:translate-y-0"
          style={{ backgroundColor: 'var(--coral)' }}
          onClick={() => viewport.zoomOut()}
          title="Zoom Out"
        >
          <ZoomOut size={16} strokeWidth={2.5} />
        </button>
        <span className="text-sm text-[color:var(--ink)] font-bold min-w-[3rem] text-center px-1">
          {viewport.zoom ? `${Math.round(viewport.zoom * 100)}%` : "100%"}
        </span>
        <button
          className="w-8 h-8 text-white sketch-button transition-all duration-150 flex items-center justify-center active:translate-y-0"
          style={{ backgroundColor: 'var(--coral)' }}
          onClick={() => viewport.zoomIn()}
          title="Zoom In"
        >
          <ZoomIn size={16} strokeWidth={2.5} />
        </button>
        <button
          className="w-8 h-8 text-white sketch-button transition-all duration-150 flex items-center justify-center active:translate-y-0"
          style={{ backgroundColor: 'var(--coral)' }}
          onClick={() => viewport.resetViewport()}
          title="Reset Viewport"
        >
          <Home size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
