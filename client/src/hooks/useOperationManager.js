import { useParams } from 'react-router-dom';
import { textState } from '../../../shared/textBox';
// Operation manager - core of the collaborative drawing system.
// Handles operation execution, inverse generation for undo/redo, conflict resolution, broadcasting.
// Flow: Local exec → Broadcast → Remote validation/exec → Inverse for undo stack.

import { useRef, useCallback, useMemo, useEffect } from 'react';
import {
  OperationType,
  createOperation,
  validateOperation,
  canOperationsConflict,
  resolveOperationConflict,
  StrokeAddPayload,
  StrokeDeletePayload,
  StrokeMovePayload,
  StrokeUndoPayload,
  StrokeStartPayload,
  StrokeProgressPayload,
  StrokeResizePayload,
  StrokeRotatePayload,
  BatchAddStrokesPayload,
  BatchDeleteStrokesPayload,
  TextAddPayload,
  TextEditPayload,
  TextDeletePayload
} from '../utils/operations';
import { useSocket } from '../contexts/SocketContext';
import { useCanvasContext } from '../contexts/CanvasContext';
import { computeBoundingBox, translatePoints, resizePoints, rotatePoints } from '../utils/geometry';
import { calculateTextBbox, resizeTextBox, refreshTextBounds } from '../utils/textBbox';
import { logger } from '../utils/logger';

export function useOperationManager(userId, redrawCallbackRef, username = 'Unknown', onChangeCallback = null) {
  const { emitOperation, currentRoom } = useSocket();
  const {
    allStrokesRef
  } = useCanvasContext();

  const { id: routeCanvasId } = useParams();
  const localChannelRef = useRef(null);
  const remoteHandlerRef = useRef(null);
  useEffect(() => {
    if (!routeCanvasId?.startsWith('local-')) return;
    const channel = new BroadcastChannel(`local-canvas-sync-${routeCanvasId}`);
    localChannelRef.current = channel;
    channel.onmessage = event => {
      if (event.data?.type === 'OPERATION') remoteHandlerRef.current?.(event.data.payload.operation);
    };
    return () => { channel.close(); localChannelRef.current = null; };
  }, [routeCanvasId]);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const pendingOperationsRef = useRef(new Map());
  
  // Wrapper to auto-include username in operations (currently unused, kept for future use)
  const createOperationWithUser = useCallback((type, payload, inverse = null) => {
    return createOperation(type, payload, userId, username, inverse);
  }, [userId, username]);
  
  const operationExecutors = useMemo(() => ({
    [OperationType.STROKE_ADD]: (operation) => {
      const { strokeId, points, config } = operation.payload;
      if (operation.payload.type === 'text') {
        const text = refreshTextBounds({ ...operation.payload, id: strokeId, type: 'text',
          userId: operation.userId, username: operation.username || username });
        allStrokesRef.current.set(strokeId, text);
        return;
      }

      const strokeData = {
        id: strokeId,
        points,
        config,
        bbox: computeBoundingBox(points),
        userId: operation.userId,
        username: operation.username || username,
      };

      // Add to unified storage (Map)
      allStrokesRef.current.set(strokeId, strokeData);
    },

    [OperationType.STROKE_DELETE]: (operation) => {
      const { strokeIds } = operation.payload;

      // Delete from unified storage (Map)
      strokeIds.forEach(strokeId => {
        allStrokesRef.current.delete(strokeId);
      });
    },

    [OperationType.STROKE_MOVE]: (operation) => {
      const { strokeIds, deltaX, deltaY } = operation.payload;
      const strokeIdSet = new Set(strokeIds); // For O(1) lookup

      // Apply to unified storage (Map)
      strokeIds.forEach(strokeId => {
        const stroke = allStrokesRef.current.get(strokeId);
        if (stroke) {
          if (stroke.type === 'text') {
            // Move text by updating x, y coordinates
            stroke.x += deltaX;
            stroke.y += deltaY;
            stroke.bbox.minX += deltaX;
            stroke.bbox.maxX += deltaX;
            stroke.bbox.minY += deltaY;
            stroke.bbox.maxY += deltaY;
          } else {
            // Move regular stroke by translating points
            stroke.points = translatePoints(stroke.points, deltaX, deltaY);
            stroke.bbox = computeBoundingBox(stroke.points);
          }
          allStrokesRef.current.set(strokeId, stroke);

          // Move any attached text along with the shape (but only if text is NOT already being moved)
          allStrokesRef.current.forEach((textStroke) => {
            if (textStroke.type === 'text' &&
                textStroke.attachedTo === strokeId &&
                !strokeIdSet.has(textStroke.id)) { // Don't move twice if text is also selected
              textStroke.x += deltaX;
              textStroke.y += deltaY;
              textStroke.bbox.minX += deltaX;
              textStroke.bbox.maxX += deltaX;
              textStroke.bbox.minY += deltaY;
              textStroke.bbox.maxY += deltaY;
              allStrokesRef.current.set(textStroke.id, textStroke);
            }
          });
        }
      });
    },

    [OperationType.STROKE_UNDO]: (operation) => {
      const { strokeId } = operation.payload;

      // Delete from unified storage (Map)
      allStrokesRef.current.delete(strokeId);
    },

    [OperationType.STROKE_START]: () => {
      // These are handled by useCollaborativeStrokes for remote operations
      // Local operations don't need processing here
    },

    [OperationType.STROKE_PROGRESS]: () => {
      // These are handled by useCollaborativeStrokes for remote operations  
      // Local operations don't need processing here
    },

    [OperationType.STROKE_RESIZE]: (operation) => {
      const { strokeIds, scaleX, scaleY, anchorPoint, restoreText } = operation.payload;

      // Apply to unified storage (Map)
      strokeIds.forEach(strokeId => {
        const stroke = allStrokesRef.current.get(strokeId);
        if (stroke) {
          if (stroke.type === 'text') {
            // When `restoreText` is set this op is an INVERSE: restore exact pre-resize values (the
            // font scale is non-linear, so reciprocal scaling can't undo it).
            if (restoreText && operation.payload.textOriginals?.[strokeId]) {
              Object.assign(stroke, structuredClone(operation.payload.textOriginals[strokeId]));
              refreshTextBounds(stroke);
            } else {
              resizeTextBox(stroke, scaleX, scaleY, anchorPoint);
            }
          } else {
            // Resize regular stroke
            stroke.points = resizePoints(stroke.points, anchorPoint, scaleX, scaleY);
            stroke.bbox = computeBoundingBox(stroke.points);
          }
          allStrokesRef.current.set(strokeId, stroke);
        }
      });
    },

    [OperationType.STROKE_ROTATE]: (operation) => {
      const { strokeIds, angleDelta, centerPoint } = operation.payload;

      // Apply to unified storage (Map)
      strokeIds.forEach(strokeId => {
        const stroke = allStrokesRef.current.get(strokeId);
        if (stroke) {
          if (stroke.type === 'text') {
            // Rotate text position around center point
            const dx = stroke.x - centerPoint.x;
            const dy = stroke.y - centerPoint.y;
            const cos = Math.cos(angleDelta);
            const sin = Math.sin(angleDelta);

            stroke.x = centerPoint.x + (dx * cos - dy * sin);
            stroke.y = centerPoint.y + (dx * sin + dy * cos);

            // Note: We don't rotate text rendering itself (would need transform matrix)
            // Text stays upright but moves around the rotation center

            // Update bbox using accurate measurement
            stroke.bbox = calculateTextBbox(stroke.text, stroke.x, stroke.y, stroke.fontSize, stroke.config);
          } else {
            // Rotate regular stroke
            stroke.points = rotatePoints(stroke.points, centerPoint, angleDelta);
            stroke.bbox = computeBoundingBox(stroke.points);
          }
          allStrokesRef.current.set(strokeId, stroke);
        }
      });
    },

    [OperationType.BATCH_ADD_STROKES]: (operation) => {
      const { strokes } = operation.payload;
      
      logger.log(`🔧 Executing BATCH_ADD_STROKES:`, {
        count: strokes.length,
        isLocal: operation.userId === userId,
        hasUserId: !!operation.userId,
        hasUsername: !!operation.username
      });
      
      // Add all strokes to unified storage (Map)
      strokes.forEach(stroke => {
        // Ensure stroke has required properties (handles both regular strokes and text)
        const isValidStroke = stroke.id && stroke.points && stroke.config;
        const isValidText = stroke.id && stroke.type === 'text' && stroke.text !== undefined;

        if (isValidStroke || isValidText) {
          // Add userId/username from operation (marks who created it)
          const strokeWithUser = {
            ...stroke,
            userId: operation.userId,
            username: operation.username,
          };
          allStrokesRef.current.set(stroke.id, strokeWithUser.type === 'text' ? refreshTextBounds(strokeWithUser) : strokeWithUser);
        }
      });
      
      logger.log(`✅ Batch added ${strokes.length} strokes, total now: ${allStrokesRef.current.size}`);
    },

    [OperationType.BATCH_DELETE_STROKES]: (operation) => {
      const { strokeIds } = operation.payload;

      // Delete all strokes from unified storage (Map)
      strokeIds.forEach(strokeId => {
        allStrokesRef.current.delete(strokeId);
      });

      logger.log(`🗑️ Batch deleted ${strokeIds.length} strokes`);
    },

    [OperationType.TEXT_UPDATE]: (operation) => {
      operation.payload.updates.forEach(({ textId, after }) => {
        const stroke = allStrokesRef.current.get(textId);
        if (stroke?.type === 'text') {
          Object.assign(stroke, structuredClone(after));
          refreshTextBounds(stroke);
        }
      });
    },
    [OperationType.TEXT_ADD]: (operation) => {
      const { textId, text, x, y, fontSize, config, attachedTo } = operation.payload;

      logger.log('✍️ TEXT_ADD executor called:', {
        textId,
        text,
        x,
        y,
        attachedTo,
        userId: operation.userId
      });

      const textData = {
        id: textId,
        type: 'text',
        text,
        x,
        y,
        fontSize,
        config,
        attachedTo,
        bbox: calculateTextBbox(text, x, y, fontSize, config), // Multiline-aware bbox
        userId: operation.userId,
        username: operation.username || username,
      };

      allStrokesRef.current.set(textId, textData);
      logger.log('✅ Text added to allStrokesRef, total strokes:', allStrokesRef.current.size);
    },

    [OperationType.TEXT_EDIT]: (operation) => {
      const { textId, newText } = operation.payload;

      const textObj = allStrokesRef.current.get(textId);
      if (textObj && textObj.type === 'text') {
        textObj.text = newText;
        textObj.bbox = calculateTextBbox(newText, textObj.x, textObj.y, textObj.fontSize, textObj.config);
        allStrokesRef.current.set(textId, textObj);
      }
    },

    [OperationType.TEXT_DELETE]: (operation) => {
      const { textId } = operation.payload;
      allStrokesRef.current.delete(textId);
    }
  }), [allStrokesRef, userId, username]);

  // Create inverse operations for undo functionality
  const createInverseOperation = useCallback((operation) => {
    switch (operation.type) {
      case OperationType.STROKE_ADD:
        return createOperation(
          OperationType.STROKE_UNDO,
          StrokeUndoPayload.create(operation.payload.strokeId),
          operation.userId,
          operation.username,
          {
            points: operation.payload.points,
            config: operation.payload.config
          }
        );

      case OperationType.STROKE_DELETE:
        // For multiple stroke deletion, create multiple add operations
        // Sort by index descending so we restore from highest index first
        // This preserves correct positions as we insert back into the array
        if (operation.inverse?.deletedStrokes) {
          const sortedStrokes = [...operation.inverse.deletedStrokes].sort((a, b) => b.index - a.index);
          return sortedStrokes.map(strokeData => {
            // Check if it's a text object or regular stroke
            if (strokeData.stroke.type === 'text') {
              // Restore text with all properties including attachedTo
              return createOperation(
                OperationType.TEXT_ADD,
                TextAddPayload.create(
                  strokeData.stroke.id,
                  strokeData.stroke.text,
                  strokeData.stroke.x,
                  strokeData.stroke.y,
                  strokeData.stroke.fontSize,
                  strokeData.stroke.config,
                  strokeData.stroke.attachedTo
                ),
                operation.userId,
                operation.username
              );
            } else {
              // Restore regular stroke
              return createOperation(
                OperationType.STROKE_ADD,
                StrokeAddPayload.create(
                  strokeData.stroke.id,
                  strokeData.stroke.points,
                  strokeData.stroke.config,
                  strokeData.index
                ),
                operation.userId,
                operation.username
              );
            }
          });
        }
        return null;

      case OperationType.STROKE_MOVE:
        return createOperation(
          OperationType.STROKE_MOVE,
          StrokeMovePayload.create(
            operation.payload.strokeIds,
            -operation.payload.deltaX,
            -operation.payload.deltaY,
            operation.payload.originalPositions
          ),
          operation.userId,
          operation.username
        );

      case OperationType.STROKE_UNDO:
        // Restore the original stroke
        if (operation.inverse) {
          return createOperation(
            OperationType.STROKE_ADD,
            StrokeAddPayload.create(
              operation.payload.strokeId,
              operation.inverse.points,
              operation.inverse.config
            ),
            operation.userId,
            operation.username
          );
        }
        return null;

      case OperationType.STROKE_RESIZE:
        // Box dimensions may clamp during resize; text restores its exact snapshot.
        return createOperation(
          OperationType.STROKE_RESIZE,
          StrokeResizePayload.create(
            operation.payload.strokeIds,
            1 / operation.payload.scaleX,
            1 / operation.payload.scaleY,
            operation.payload.anchorPoint,
            operation.payload.position,
            operation.payload.textOriginals,
            true, // restoreText — text restores exact values; strokes reciprocal-scale
            operation.payload.originalBbox
          ),
          operation.userId,
          operation.username
        );

      case OperationType.STROKE_ROTATE:
        // Inverse rotate: apply negative angle
        return createOperation(
          OperationType.STROKE_ROTATE,
          StrokeRotatePayload.create(
            operation.payload.strokeIds,
            -operation.payload.angleDelta,
            operation.payload.centerPoint,
            operation.payload.originalPoints
          ),
          operation.userId,
          operation.username
        );

      case OperationType.BATCH_ADD_STROKES:
        // Inverse: Delete all the strokes that were added
        return createOperation(
          OperationType.BATCH_DELETE_STROKES,
          BatchDeleteStrokesPayload.create(
            operation.payload.strokeIds,
            operation.payload.strokes
          ),
          operation.userId,
          operation.username
        );

      case OperationType.BATCH_DELETE_STROKES:
        // Inverse: Add all the strokes that were deleted
        return createOperation(
          OperationType.BATCH_ADD_STROKES,
          BatchAddStrokesPayload.create(operation.payload.strokes),
          operation.userId,
          operation.username
        );

      case OperationType.TEXT_UPDATE:
        return createOperation(OperationType.TEXT_UPDATE, {
          updates: operation.payload.updates.map(({ textId, before, after }) => ({ textId, before: after, after: before })),
        }, operation.userId, operation.username);

      case OperationType.TEXT_ADD:
        // Inverse: Delete the text
        return createOperation(
          OperationType.TEXT_DELETE,
          TextDeletePayload.create(operation.payload.textId, operation.payload),
          operation.userId,
          operation.username
        );

      case OperationType.TEXT_EDIT:
        // Inverse: Restore old text
        return createOperation(
          OperationType.TEXT_EDIT,
          TextEditPayload.create(operation.payload.textId, operation.payload.oldText, operation.payload.newText),
          operation.userId,
          operation.username
        );

      case OperationType.TEXT_DELETE:
        // Inverse: Re-add the text
        if (operation.payload.textData) {
          return createOperation(
            OperationType.TEXT_ADD,
            TextAddPayload.create(
              operation.payload.textId,
              operation.payload.textData.text,
              operation.payload.textData.x,
              operation.payload.textData.y,
              operation.payload.textData.fontSize,
              operation.payload.textData.config,
              operation.payload.textData.attachedTo
            ),
            operation.userId,
            operation.username
          );
        }
        return null;

      default:
        return null;
    }
  }, []);

  // Execute operation with validation and conflict resolution
  const executeOperation = useCallback((operation, isLocal = true, skipBroadcast = false, skipUndoStack = false) => {
    logger.log(`⚙️ executeOperation:`, {
      type: operation.type,
      id: operation.id,
      isLocal,
      skipBroadcast,
      skipUndoStack
    });
    
    const validation = validateOperation(operation);
    if (!validation.valid) {
      logger.error('Invalid operation:', validation.error);
      return false;
    }

    // Check for conflicts with pending operations
    if (!isLocal) {
      const conflicts = Array.from(pendingOperationsRef.current.values())
        .filter(pendingOp => canOperationsConflict(operation, pendingOp));
      
      if (conflicts.length > 0) {
        // Resolve conflicts using timestamp
        conflicts.forEach(conflictOp => {
          const resolution = resolveOperationConflict(conflictOp, operation);
          if (resolution.winner === operation) {
            // Cancel the conflicting local operation
            pendingOperationsRef.current.delete(conflictOp.id);
          } else {
            // Reject the remote operation
            return false;
          }
        });
      }
    }

    // Execute the operation
    const executor = operationExecutors[operation.type];
    if (executor) {
      executor(operation, isLocal);
      if (isLocal && !skipBroadcast) localChannelRef.current?.postMessage({ type: 'OPERATION', payload: { operation } });
      
      if (isLocal && !skipUndoStack) {
        // Add to undo stack only for new operations (not undo/redo)
        undoStackRef.current.push(operation);
        redoStackRef.current = []; // Clear redo stack

        // Mark canvas as having unsaved changes
        if (onChangeCallback) {
          onChangeCallback();
        }

        // Broadcast to collaborators
        if (currentRoom && !skipBroadcast && emitOperation) {
          logger.log(`📡 Broadcasting operation:`, operation.type, operation.id);
          emitOperation(operation);
        } else {
          logger.log(`❌ NOT broadcasting:`, {
            hasRoom: !!currentRoom,
            skipBroadcast,
            hasEmit: !!emitOperation,
            type: operation.type
          });
        }
      } else if (isLocal && skipUndoStack) {
        // For undo/redo operations, still broadcast but don't touch stacks
        // Also mark changes for undo/redo
        if (onChangeCallback) {
          onChangeCallback();
        }
        
        if (currentRoom && !skipBroadcast && emitOperation) {
          emitOperation(operation);
        }
      }
      
      if (redrawCallbackRef.current) {
        redrawCallbackRef.current();
      }
      return true;
    }
    
    return false;
  }, [currentRoom, emitOperation, operationExecutors, redrawCallbackRef, onChangeCallback]);

  // Helper to execute a raw operation with user info
  const executeOperationWithUser = useCallback((operation) => {
    // Add user info to operation
    const fullOperation = {
      ...operation,
      userId,
      username,
      timestamp: operation.timestamp || Date.now(),
      id: operation.id || `op_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`,
    };
    
    return executeOperation(fullOperation, true);
  }, [userId, username, executeOperation]);

  // High-level operation creators
  const addStroke = useCallback((strokeId, points, config) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_ADD,
      StrokeAddPayload.create(strokeId, points, config)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const deleteStrokes = useCallback((strokeIds, deletedStrokeData) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_DELETE,
      StrokeDeletePayload.create(strokeIds, deletedStrokeData),
      { deletedStrokes: deletedStrokeData } // Inverse data for undo
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const moveStrokes = useCallback((strokeIds, deltaX, deltaY, originalPositions) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_MOVE,
      StrokeMovePayload.create(strokeIds, deltaX, deltaY, originalPositions),
      { originalPositions } // Inverse data for undo
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const undoStroke = useCallback((strokeId) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_UNDO,
      StrokeUndoPayload.create(strokeId)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const startStroke = useCallback((strokeId, point, config) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_START,
      StrokeStartPayload.create(strokeId, point, config)
    );

    // Don't add to undo stack, just broadcast
    return executeOperation(operation, true, false, true);
  }, [executeOperation, createOperationWithUser]);

  const progressStroke = useCallback((strokeId, point) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_PROGRESS,
      StrokeProgressPayload.create(strokeId, point)
    );

    // Don't add to undo stack, just broadcast
    return executeOperation(operation, true, false, true);
  }, [executeOperation, createOperationWithUser]);

  const resizeStrokes = useCallback((strokeIds, scaleX, scaleY, anchorPoint, position = null, textOriginals = null, originalBbox = null) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_RESIZE,
      StrokeResizePayload.create(strokeIds, scaleX, scaleY, anchorPoint, position, textOriginals, false, originalBbox)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const rotateStrokes = useCallback((strokeIds, angleDelta, centerPoint, originalPoints) => {
    const operation = createOperationWithUser(
      OperationType.STROKE_ROTATE,
      StrokeRotatePayload.create(strokeIds, angleDelta, centerPoint, originalPoints),
      { originalPoints } // Inverse data for undo
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const addText = useCallback((textId, text, x, y, fontSize, config, attachedTo = null) => {
    const operation = createOperationWithUser(
      OperationType.TEXT_ADD,
      TextAddPayload.create(textId, text, x, y, fontSize, config, attachedTo)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const updateTexts = useCallback((changes) => {
    const updates = changes.flatMap(({ textId, after }) => {
      const stroke = allStrokesRef.current.get(textId);
      if (stroke?.type !== 'text') return [];
      const before = textState(stroke);
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ textId, before, after }];
    });
    if (!updates.length) return false;
    return executeOperation(createOperationWithUser(OperationType.TEXT_UPDATE, { updates }), true);
  }, [allStrokesRef, executeOperation, createOperationWithUser]);

  const editText = useCallback((textId, newText, oldText) => {
    const operation = createOperationWithUser(
      OperationType.TEXT_EDIT,
      TextEditPayload.create(textId, newText, oldText)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const deleteText = useCallback((textId, textData) => {
    const operation = createOperationWithUser(
      OperationType.TEXT_DELETE,
      TextDeletePayload.create(textId, textData)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const batchAddStrokes = useCallback((strokes) => {
    const operation = createOperationWithUser(
      OperationType.BATCH_ADD_STROKES,
      BatchAddStrokesPayload.create(strokes)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  const batchDeleteStrokes = useCallback((strokeIds, strokes) => {
    const operation = createOperationWithUser(
      OperationType.BATCH_DELETE_STROKES,
      BatchDeleteStrokesPayload.create(strokeIds, strokes)
    );

    return executeOperation(operation, true);
  }, [executeOperation, createOperationWithUser]);

  // Undo/Redo functionality
  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return false;
    
    const lastOperation = undoStackRef.current.pop();
    const inverseOperation = createInverseOperation(lastOperation);
    
    if (inverseOperation) {
      // Handle multiple inverse operations (for delete undo)
      if (Array.isArray(inverseOperation)) {
        inverseOperation.forEach(op => {
          executeOperation(op, true, false, true); // skipUndoStack = true
        });
      } else {
        executeOperation(inverseOperation, true, false, true); // skipUndoStack = true
      }
      
      redoStackRef.current.push(lastOperation);
      return true;
    }
    
    return false;
  }, [executeOperation, createInverseOperation]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return false;
    
    const operation = redoStackRef.current.pop();
    executeOperation(operation, true, false, true); // skipUndoStack = true
    
    // Manually add the operation back to undo stack (since we skipped auto-adding)
    undoStackRef.current.push(operation);
    
    return true;
  }, [executeOperation]);

  // Handle remote operations from other users (goes to remoteStrokesRef)
  const handleRemoteOperation = useCallback((operation) => {
    logger.log(`🌐 handleRemoteOperation called:`, operation.type, operation.id);
    const result = executeOperation(operation, false, true); // isLocal=false, skipBroadcast=true
    logger.log(`   Result:`, result ? 'SUCCESS' : 'FAILED');
    return result;
  }, [executeOperation]);

  remoteHandlerRef.current = handleRemoteOperation;

  // Adopt room operations as local when joining (goes to finishedStrokesRef)
  const adoptRoomOperation = useCallback((operation) => {
    executeOperation(operation, true, true, true); // isLocal=true, skipBroadcast=true, skipUndoStack=true
  }, [executeOperation]);

  // Clear all operations (for room changes)
  const clearOperations = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    pendingOperationsRef.current.clear();
  }, []);

  return {
    // Operation creators
    addStroke,
    deleteStrokes,
    moveStrokes,
    undoStroke,
    startStroke,
    progressStroke,
    resizeStrokes,
    rotateStrokes,
    addText,
    editText,
    updateTexts,
    deleteText,
    batchAddStrokes,
    batchDeleteStrokes,

    // Undo/Redo
    undo,
    redo,
    canUndo: () => undoStackRef.current.length > 0,
    canRedo: () => redoStackRef.current.length > 0,

    // Remote operation handling
    handleRemoteOperation,
    adoptRoomOperation, // For rebuilding room state as local

    // Utility
    clearOperations,

    // Direct operation execution (for complex cases)
    executeOperation,
    executeOperationWithUser,
  };
}