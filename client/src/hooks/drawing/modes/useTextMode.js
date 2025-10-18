import { useState, useCallback, useRef } from 'react';
import { generateUniqueId } from '../../../utils/idGenerator';
import { pointInBoundingBox } from '../../../utils/geometry';
import { logger } from '../../../utils/logger';

/**
 * Calculate text position so that text bbox center aligns with shape bbox center
 * Returns (x, y) where text should be drawn (x=left edge, y=baseline)
 */
function getCenteredTextPosition(stroke, text, fontSize) {
  if (!stroke.bbox) return null;

  const shapeCenterX = (stroke.bbox.minX + stroke.bbox.maxX) / 2;
  const shapeCenterY = (stroke.bbox.minY + stroke.bbox.maxY) / 2;

  // Calculate what the text bbox would be if drawn at (0, 0)
  const tempBbox = calculateTextBbox(text || 'A', 0, 0, fontSize);

  // Text bbox dimensions
  const textWidth = tempBbox.maxX - tempBbox.minX;
  const textHeight = tempBbox.maxY - tempBbox.minY;

  // Text bbox center would be at these offsets from (x, y)
  const textBboxCenterOffsetX = textWidth / 2;
  const textBboxCenterOffsetY = (tempBbox.minY + tempBbox.maxY) / 2;

  // Calculate (x, y) such that text bbox center lands on shape center
  return {
    x: shapeCenterX - textBboxCenterOffsetX,
    y: shapeCenterY - textBboxCenterOffsetY
  };
}

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

/**
 * Text mode handler - single-click to place text, double-click to edit
 * Uses inline editing (no modal) with multiline support
 */
export function useTextMode({
  canvasHelpers,
  operationManager,
  brushSettings,
  onTextClick,  // Callback to trigger inline editor
  allStrokesRef,
  canEdit
}) {
  const [pendingTextPosition, setPendingTextPosition] = useState(null);
  const lastClickTime = useRef(0);
  const lastClickedTextId = useRef(null);
  const editorJustClosedTime = useRef(0); // Track when editor was last closed

  const handleMouseDown = useCallback((e) => {
    if (!canEdit) {
      return { handled: false };
    }

    const point = canvasHelpers.getCanvasPoint(e);
    if (!point) {
      return { handled: false };
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;
    const timeSinceEditorClosed = now - editorJustClosedTime.current;

    logger.log('🖱️ Text mode click:', { timeSinceEditorClosed, editorJustClosedTime: editorJustClosedTime.current });

    // Ignore click if editor was just closed (within 200ms) to prevent reopening
    if (timeSinceEditorClosed < 200) {
      logger.log('⏸️ Ignoring click - editor just closed');
      return { handled: true };
    }

    // Check if clicking on existing text
    let clickedText = null;
    allStrokesRef.current.forEach((stroke) => {
      if (stroke.type === 'text' && pointInBoundingBox(point, stroke.bbox)) {
        clickedText = stroke;
      }
    });

    // Double-click detection (within 500ms, increased from 300ms for easier triggering)
    if (clickedText && timeSinceLastClick < 500 && lastClickedTextId.current === clickedText.id) {
      // Double-click on existing text → edit mode
      onTextClick({
        mode: 'edit',
        textId: clickedText.id,
        x: clickedText.x,
        y: clickedText.y,
        text: clickedText.text,
        fontSize: clickedText.fontSize,
        color: clickedText.config.color
      });
      lastClickTime.current = 0; // Reset to prevent triple-click
      lastClickedTextId.current = null;
      return { handled: true };
    }

    // First click on existing text → just track for double-click, don't place new text
    if (clickedText) {
      lastClickTime.current = now;
      lastClickedTextId.current = clickedText.id;
      return { handled: true };
    }

    // Check if clicking on a shape (non-text stroke)
    let clickedShape = null;
    allStrokesRef.current.forEach((stroke) => {
      if (stroke.type !== 'text' && stroke.bbox && pointInBoundingBox(point, stroke.bbox)) {
        clickedShape = stroke;
      }
    });

    // If clicking shape, check if it already has text attached
    let textX = point.x;
    let textY = point.y;
    let attachedToId = null;

    if (clickedShape) {
      // Check if shape already has text attached (only allow one text per shape)
      let existingText = null;
      allStrokesRef.current.forEach((stroke) => {
        if (stroke.type === 'text' && stroke.attachedTo === clickedShape.id) {
          existingText = stroke;
        }
      });

      if (existingText) {
        // Shape already has text - edit existing text instead
        logger.log('⚠️ Shape already has text - editing existing');
        onTextClick({
          mode: 'edit',
          textId: existingText.id,
          x: existingText.x,
          y: existingText.y,
          text: existingText.text,
          fontSize: existingText.fontSize,
          color: existingText.config.color
        });
        return { handled: true };
      }

      // No existing text - center new text on shape
      const centeredPos = getCenteredTextPosition(clickedShape, '', 16);
      if (centeredPos) {
        textX = centeredPos.x;
        textY = centeredPos.y;
        attachedToId = clickedShape.id;
      }
    }

    // Single click → place new text (centered on shape if clicked, or at cursor)
    const textPosition = {
      mode: 'add',
      x: textX,
      y: textY,
      textId: generateUniqueId('text'),
      fontSize: 16,
      color: brushSettings.color,
      attachedTo: attachedToId
    };

    setPendingTextPosition(textPosition);
    onTextClick(textPosition);

    lastClickTime.current = now;
    lastClickedTextId.current = null; // No text at this location

    return { handled: true };
  }, [canvasHelpers, canEdit, onTextClick, allStrokesRef, brushSettings]);

  const handleMouseMove = useCallback(() => {
    return { handled: false };
  }, []);

  const handleMouseUp = useCallback(() => {
    return { handled: false };
  }, []);

  // Create temporary text object for live preview
  const createTempText = useCallback((textId, text, x, y, fontSize, color, attachedTo = null) => {
    const textObj = {
      id: textId,
      type: 'text',
      text: text,
      x: x,
      y: y,
      fontSize: fontSize,
      config: {
        color: color,
        fontFamily: 'Comic Sans MS'
      },
      attachedTo: attachedTo,
      bbox: calculateTextBbox(text, x, y, fontSize),
      isTemporary: true // Mark as temporary so we don't broadcast it
    };
    allStrokesRef.current.set(textId, textObj);
    return textObj;
  }, [allStrokesRef]);

  // Update temporary text object during typing
  const updateTempText = useCallback((textId, newText) => {
    const textObj = allStrokesRef.current.get(textId);
    if (!textObj || textObj.type !== 'text') return;

    // If text is attached to a shape, recenter it as text grows/shrinks
    if (textObj.attachedTo) {
      const parentShape = allStrokesRef.current.get(textObj.attachedTo);
      if (parentShape) {
        const centeredPos = getCenteredTextPosition(parentShape, newText, textObj.fontSize);
        if (centeredPos) {
          textObj.x = centeredPos.x;
          textObj.y = centeredPos.y;
        }
      }
    }

    textObj.text = newText;
    textObj.bbox = calculateTextBbox(newText, textObj.x, textObj.y, textObj.fontSize);
    allStrokesRef.current.set(textId, textObj);
  }, [allStrokesRef]);

  const addTextAtPosition = useCallback((text, fontSize = 16) => {
    if (!pendingTextPosition || !text || !canEdit) return;

    // Get the text object which has been updated by updateTempText with correct position
    const textObj = allStrokesRef.current.get(pendingTextPosition.textId);
    if (!textObj) return;

    // Check if already submitted (not temporary anymore)
    if (!textObj.isTemporary) {
      logger.log('⚠️ Text already submitted, skipping duplicate');
      return;
    }

    // Remove temporary flag
    delete textObj.isTemporary;
    allStrokesRef.current.set(pendingTextPosition.textId, textObj);

    // Use textObj's current x,y (which has been recentered during typing if attached)
    operationManager.addText(
      pendingTextPosition.textId,
      text,
      textObj.x,
      textObj.y,
      fontSize,
      {
        color: pendingTextPosition.color || brushSettings.color,
        fontFamily: 'Comic Sans MS'
      },
      textObj.attachedTo || null
    );

    // Don't clear pendingTextPosition here - let editor close handler do it
    // setPendingTextPosition(null);
  }, [pendingTextPosition, operationManager, brushSettings, canEdit, allStrokesRef]);

  const editTextAtPosition = useCallback((textId, newText) => {
    if (!canEdit) return;

    const textObj = allStrokesRef.current.get(textId);
    if (!textObj || textObj.type !== 'text') return;

    operationManager.editText(textId, newText, textObj.text);
  }, [operationManager, allStrokesRef, canEdit]);

  // Cancel editing - remove temporary text
  const cancelTextEdit = useCallback((textId) => {
    const textObj = allStrokesRef.current.get(textId);
    if (textObj && textObj.isTemporary) {
      allStrokesRef.current.delete(textId);
    }
    setPendingTextPosition(null);
  }, [allStrokesRef]);

  // Mark that editor just closed to prevent immediate reopening
  const notifyEditorClosed = useCallback(() => {
    editorJustClosedTime.current = Date.now();
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    addTextAtPosition,
    editTextAtPosition,
    createTempText,
    updateTempText,
    cancelTextEdit,
    notifyEditorClosed,
    pendingTextPosition
  };
}
