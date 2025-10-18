import React, { useEffect, useState, useCallback } from "react";
import { useDraw } from "../../hooks/useDraw";
import { drawLine } from "../../utils/draw";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { useViewportContext } from "../../contexts/ViewportContext";
import InlineTextEditor from '../canvas/InlineTextEditor';
import { Loader2, Eye } from 'lucide-react';
import { logger } from '../../utils/logger';

/**
 * Calculate bounding box for multiline text using actual canvas measurement
 */
function calculateTextBbox(text, x, y, fontSize) {
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;

  // Use canvas to accurately measure text width
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px Comic Sans MS, cursive`;

  let maxWidth = 0;
  lines.forEach(line => {
    if (line.length > 0) {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    }
  });

  // Add small padding for safety
  maxWidth += 10;

  const totalHeight = lines.length * lineHeight;

  return {
    minX: x,
    maxX: x + maxWidth,
    minY: y - fontSize,
    maxY: y + totalHeight - fontSize
  };
}

export default function CanvasBoard() {
  const { canvasRef, setUndoRedo, setOperationManager, allStrokesRef, clearSelection } = useCanvasContext();
  const { viewport } = useViewportContext();
  const { getCanvasDataRef, setCanvasDataRef, canEdit, userRole, loading, isNew, canvasId } = useCanvasPersistence();

  const [textEditorState, setTextEditorState] = useState(null);
  const textEditorRef = React.useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const { redrawCanvas, handleUndo, handleRedo, operationManager, textMode, setTextClickCallback } = useDraw(canvasRef, drawLine, textEditorRef);

  // Setup text click callback for inline editor
  useEffect(() => {
    setTextClickCallback((position) => {
      // If editor already open, ignore this click (blur will submit the current text)
      if (textEditorState) {
        logger.log('⏸️ Editor already open - ignoring new click (blur will handle submit)');
        return; // Don't open new editor, let blur handle the current one
      }

      // Convert canvas coordinates to screen coordinates for inline editor
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');

      // Apply viewport transform to get screen position
      ctx.save();
      viewport.applyTransform(ctx, canvas.width, canvas.height);
      const transform = ctx.getTransform();
      ctx.restore();

      const screenX = position.x * transform.a + transform.e + rect.left;
      const screenY = position.y * transform.d + transform.f + rect.top;

      // For add mode, create temporary text object for live preview
      if (position.mode === 'add' && textMode) {
        textMode.createTempText(
          position.textId,
          '', // Start with empty text
          position.x,
          position.y,
          position.fontSize || 16,
          position.color,
          position.attachedTo || null
        );
        redrawCanvas(); // Show the temporary text immediately
      }

      setTextEditorState({
        ...position,
        screenX,
        screenY,
        zoom: viewport.zoom
      });
    });
  }, [setTextClickCallback, viewport, canvasRef, textMode, redrawCanvas, textEditorState, allStrokesRef]);

  const handleTextChange = useCallback((text) => {
    if (!textMode || !textEditorState) return;

    // Update temporary text in real-time
    if (textEditorState.mode === 'add') {
      textMode.updateTempText(textEditorState.textId, text);
      redrawCanvas();
    } else if (textEditorState.mode === 'edit') {
      // For edit mode, also update live
      const textObj = allStrokesRef.current.get(textEditorState.textId);
      if (textObj && textObj.type === 'text') {
        textObj.text = text;
        textObj.bbox = calculateTextBbox(text, textObj.x, textObj.y, textObj.fontSize);
        allStrokesRef.current.set(textEditorState.textId, textObj);
        redrawCanvas();
      }
    }
  }, [textMode, textEditorState, redrawCanvas, allStrokesRef]);

  const handleTextSubmit = useCallback((text) => {
    if (!textMode || !textEditorState) return;

    // Capture state before clearing
    const currentState = textEditorState;

    if (!text) {
      // Empty text - cancel
      if (currentState.mode === 'add') {
        textMode.cancelTextEdit(currentState.textId);
      }
      setTextEditorState(null);
      textMode.notifyEditorClosed();
      redrawCanvas();
      return;
    }

    // Submit the text (may be called multiple times - Ctrl+Enter then blur)
    if (currentState.mode === 'edit') {
      textMode.editTextAtPosition(currentState.textId, text);
    } else {
      textMode.addTextAtPosition(text, currentState.fontSize || 16);
    }

    // Close editor after submitting
    setTextEditorState(null);
    textMode.notifyEditorClosed();
    redrawCanvas();
  }, [textMode, textEditorState, redrawCanvas]);

  const handleTextCancel = useCallback(() => {
    if (!textMode || !textEditorState) return;

    // Close editor immediately
    const currentState = textEditorState;
    setTextEditorState(null);
    textMode.notifyEditorClosed(); // Prevent immediate reopening

    // Remove temporary text if canceling
    if (currentState.mode === 'add') {
      textMode.cancelTextEdit(currentState.textId);
      redrawCanvas();
    } else if (currentState.mode === 'edit') {
      // Restore original text
      const textObj = allStrokesRef.current.get(currentState.textId);
      if (textObj && textObj.type === 'text' && currentState.text) {
        textObj.text = currentState.text;
        textObj.bbox = calculateTextBbox(currentState.text, textObj.x, textObj.y, textObj.fontSize);
        allStrokesRef.current.set(currentState.textId, textObj);
        redrawCanvas();
      }
    }
  }, [textMode, textEditorState, redrawCanvas, allStrokesRef]);

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
          allStrokesRef.current.set(stroke.id, stroke);
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
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="sketch-panel bg-gradient-to-br from-[#f08080] to-[#ffdab9] px-8 py-6 border-4 border-black flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-6xl h-16 w-16" />
            <p className="text-2xl font-bold -rotate-1" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
              Loading Canvas...
            </p>
          </div>
        </div>
      )}

      {/* View-Only Indicator (bottom-left corner) */}
      {!canEdit && userRole === 'VIEWER' && (
        <div className="fixed bottom-24 left-4 pointer-events-none z-10">
          <div className="bg-yellow-100/90 sketch-panel px-4 py-2 border-2 border-yellow-300 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <span className="font-bold text-sm" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
              View Only
            </span>
          </div>
        </div>
      )}

      {/* Inline Text Editor */}
      {textEditorState && (
        <InlineTextEditor
          ref={textEditorRef}
          text={textEditorState.text || ''}
          x={textEditorState.screenX}
          y={textEditorState.screenY}
          fontSize={textEditorState.fontSize || 16}
          color={textEditorState.color || '#000000'}
          zoom={textEditorState.zoom || 1}
          onChange={handleTextChange}
          onSubmit={handleTextSubmit}
          onCancel={handleTextCancel}
          onBlurStart={() => textMode?.notifyEditorClosed()}
        />
      )}
    </div>
  );
}
