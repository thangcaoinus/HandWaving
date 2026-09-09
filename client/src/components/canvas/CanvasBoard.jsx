import { textState } from '../../../../shared/textBox';
import React, { useEffect, useState, useCallback } from "react";
import { useDraw } from "../../hooks/useDraw";
import { drawLine } from "../../utils/draw";
import { useCanvasContext, useCanvasSnapshot } from "../../contexts/CanvasContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { useViewportContext } from "../../contexts/ViewportContext";
import InlineTextEditor from '../canvas/InlineTextEditor';
import { Loader2, Eye } from 'lucide-react';
import { ensureTextBox, refreshTextBounds } from '../../utils/textBbox';
import { refreshImageBounds } from '../../utils/imageBbox';
import { logger } from '../../utils/logger';

export default function CanvasBoard() {
  const { canvasRef, setUndoRedo, setOperationManager, allStrokesRef, clearSelection, textDraftRef, notifyCanvasChange } = useCanvasContext();
  const { viewport } = useViewportContext();
  const { getCanvasDataRef, setCanvasDataRef, canEdit, userRole, loading, isNew, canvasId } = useCanvasPersistence();

  const snapshot = useCanvasSnapshot();
  const textEditorState = snapshot.draft;
  const [editorNotice, setEditorNotice] = useState('');
  const textEditorRef = React.useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const { redrawCanvas, handleUndo, handleRedo, operationManager, setTextClickCallback } = useDraw(canvasRef, drawLine, textEditorRef);

  useEffect(() => {
    setTextClickCallback(({ mode, object }) => {
      if (textDraftRef.current || !canEdit) return;
      textDraftRef.current = { mode, original: textState(object), object: ensureTextBox(structuredClone(object)) };
      setEditorNotice('');
      notifyCanvasChange();
      redrawCanvas();
    });
  }, [setTextClickCallback, textDraftRef, notifyCanvasChange, redrawCanvas, canEdit]);

  const handleTextChange = useCallback(text => {
    const draft = textDraftRef.current;
    if (!draft) return;
    draft.object.text = text;
    refreshTextBounds(draft.object);
    redrawCanvas();
  }, [textDraftRef, redrawCanvas]);

  const handleTextCancel = useCallback(() => {
    textDraftRef.current = null;
    notifyCanvasChange();
    redrawCanvas();
  }, [textDraftRef, notifyCanvasChange, redrawCanvas]);

  const handleTextSubmit = useCallback((force = false) => {
    const draft = textDraftRef.current;
    if (!draft || !canEdit) return;
    const object = draft.object;
    if (!object.text.trim()) { handleTextCancel(); return; }
    if (draft.mode === 'edit') {
      const current = allStrokesRef.current.get(object.id);
      if (!current) { handleTextCancel(); return; }
      if (!force && JSON.stringify(textState(current)) !== JSON.stringify(draft.original)) {
        draft.conflict = true;
        notifyCanvasChange();
        return;
      }
      operationManager.updateTexts([{ textId: object.id, after: textState(object) }]);
    } else {
      operationManager.addText(object.id, object.text, object.x, object.y, object.fontSize, object.config, object.attachedTo);
    }
    textDraftRef.current = null;
    notifyCanvasChange();
    redrawCanvas();
  }, [textDraftRef, canEdit, handleTextCancel, allStrokesRef, operationManager, notifyCanvasChange, redrawCanvas]);

  useEffect(() => {
    const draft = textDraftRef.current;
    if (draft && (!canEdit || (draft.mode === 'edit' && !allStrokesRef.current.has(draft.object.id)))) {
      handleTextCancel();
      setEditorNotice(canEdit ? 'This text box was deleted by a collaborator.' : 'Editing ended because your access changed.');
    }
  }, [snapshot, canEdit, textDraftRef, allStrokesRef, handleTextCancel]);

  // Provide undo/redo functions to context
  useEffect(() => {
    if (setUndoRedo) {
      setUndoRedo(handleUndo, handleRedo);
    }
  }, [handleUndo, handleRedo, setUndoRedo]);
  
  // Provide operation manager to context
  useEffect(() => {
    if (setOperationManager && operationManager) {
      setOperationManager(operationManager);
    }
  }, [operationManager, setOperationManager]);

  useEffect(() => {
    getCanvasDataRef.current = () => {
      // Convert Map to Array for saving to DB (filter out temporary objects)
      const strokesArray = Array.from(allStrokesRef.current.values())
        .filter(stroke => !stroke.isTemporary);

      logger.log('💾 getCanvasData called:', {
        totalStrokes: allStrokesRef.current.size,
        savedStrokes: strokesArray.length,
        textObjects: strokesArray.filter(s => s.type === 'text').length
      });

      return {
        strokes: strokesArray,
        viewport: {
          zoom: viewport.zoom,
          pan: viewport.pan,
        },
        version: '1.0',
      };
    };

    setCanvasDataRef.current = (data) => {
      logger.log('🔧 setCanvasData called with:', data);
      if (data.strokes) {
        logger.log('✅ Loading strokes:', data.strokes.length, 'strokes');
        // Convert Array to Map for unified storage
        allStrokesRef.current.clear();
        data.strokes.forEach(stroke => {
          const withBounds = stroke.type === 'text' ? refreshTextBounds(stroke)
            : stroke.type === 'image' ? refreshImageBounds(stroke)
            : stroke;
          allStrokesRef.current.set(stroke.id, withBounds);
        });
        logger.log('✅ allStrokesRef.current now has:', allStrokesRef.current.size, 'strokes');
        // Clear selection to prevent stale stroke IDs from causing issues
        clearSelection();
        redrawCanvas();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      redrawCanvas();
    };

    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [canvasRef, redrawCanvas]);

  return (
    <div className="fixed inset-0">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 touch-none hover:cursor-crosshair"
      />
      
      {/* Loading Screen - show when loading API data for existing canvas */}
      {loading && !isNew && canvasId && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 bg-[color:color-mix(in_srgb,var(--paper)_82%,transparent)]">
          <div className="sketch-panel paper-card px-8 py-6 border-2 border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] flex flex-col items-center gap-4">
            <Loader2 className="animate-spin h-16 w-16 text-[color:var(--coral)]" />
            <p className="font-display text-2xl -rotate-1 text-[color:var(--ink)]">
              Loading Canvas...
            </p>
          </div>
        </div>
      )}

      {/* View-Only Indicator (bottom-left corner) */}
      {!canEdit && userRole === 'VIEWER' && (
        <div className="fixed bottom-24 left-4 pointer-events-none z-10">
          <div className="bg-yellow-100/90 sketch-panel px-4 py-2 border-2 border-yellow-300 flex items-center gap-2 text-yellow-900">
            <Eye className="w-5 h-5" />
            <span className="font-display text-base">
              View Only
            </span>
          </div>
        </div>
      )}

      {editorNotice && <div role="status" className="fixed bottom-8 left-1/2 -translate-x-1/2 paper-card p-3 z-20">{editorNotice}</div>}
      {textEditorState && (() => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const object = textEditorState.object;
        const rect = canvas.getBoundingClientRect();
        const screen = viewport.canvasToScreen(object.x, object.y - object.fontSize, canvas.width, canvas.height);
        return <InlineTextEditor ref={textEditorRef} object={object}
          x={screen.x + rect.left} y={screen.y + rect.top} zoom={viewport.zoom}
          conflict={textEditorState.conflict} onChange={handleTextChange}
          onSubmit={handleTextSubmit} onCancel={handleTextCancel} />;
      })()}
    </div>
  );
}
