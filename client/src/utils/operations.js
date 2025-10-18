import { generateUniqueId } from './idGenerator';

// Operation types enum
export const OperationType = {
  STROKE_ADD: 'STROKE_ADD',
  STROKE_DELETE: 'STROKE_DELETE',
  STROKE_MOVE: 'STROKE_MOVE',
  STROKE_UNDO: 'STROKE_UNDO',
  STROKE_START: 'STROKE_START',
  STROKE_PROGRESS: 'STROKE_PROGRESS',
  STROKE_RESIZE: 'STROKE_RESIZE',
  STROKE_ROTATE: 'STROKE_ROTATE',
  SELECTION_CHANGE: 'SELECTION_CHANGE',
  BATCH_ADD_STROKES: 'BATCH_ADD_STROKES',
  BATCH_DELETE_STROKES: 'BATCH_DELETE_STROKES',
  TEXT_ADD: 'TEXT_ADD',
  TEXT_EDIT: 'TEXT_EDIT',
  TEXT_DELETE: 'TEXT_DELETE',
};

// Generate unique operation ID
export const generateOperationId = () => {
  return generateUniqueId('op');
};

// Base operation structure
export const createOperation = (type, payload, userId = null, username = null, inverse = null) => {
  return {
    id: generateOperationId(),
    type,
    timestamp: Date.now(),
    userId,
    username,
    payload,
    inverse
  };
};

// Operation payload structures
export const StrokeAddPayload = {
  create: (strokeId, points, config, strokeIndex = null) => ({
    strokeId,
    points,
    config,
    strokeIndex
  })
};

export const StrokeDeletePayload = {
  create: (strokeIds, deletedStrokes) => ({
    strokeIds,
    deletedStrokes
  })
};

export const StrokeMovePayload = {
  create: (strokeIds, deltaX, deltaY, originalPositions) => ({
    strokeIds,
    deltaX,
    deltaY,
    originalPositions
  })
};

export const StrokeUndoPayload = {
  create: (strokeId) => ({
    strokeId
  })
};

export const StrokeStartPayload = {
  create: (strokeId, point, config) => ({
    strokeId,
    point,
    config
  })
};

export const StrokeProgressPayload = {
  create: (strokeId, point) => ({
    strokeId,
    point
  })
};

export const StrokeResizePayload = {
  create: (strokeIds, scaleX, scaleY, anchorPoint) => ({
    strokeIds,
    scaleX,
    scaleY,
    anchorPoint
  })
};

export const StrokeRotatePayload = {
  create: (strokeIds, angleDelta, centerPoint, originalPoints) => ({
    strokeIds,
    angleDelta,
    centerPoint,
    originalPoints
  })
};

export const BatchAddStrokesPayload = {
  create: (strokes) => ({
    strokes,
    strokeIds: strokes.map(s => s.id)
  })
};

export const BatchDeleteStrokesPayload = {
  create: (strokeIds, strokes) => ({
    strokeIds,
    strokes // Store actual strokes for undo
  })
};

export const TextAddPayload = {
  create: (textId, text, x, y, fontSize, config, attachedTo = null) => ({
    textId,
    text,
    x,
    y,
    fontSize,
    config,
    attachedTo
  })
};

export const TextEditPayload = {
  create: (textId, newText, oldText) => ({
    textId,
    newText,
    oldText
  })
};

export const TextDeletePayload = {
  create: (textId, textData) => ({
    textId,
    textData
  })
};

// Operation validation
export const validateOperation = (operation) => {
  if (!operation || typeof operation !== 'object') {
    return { valid: false, error: 'Operation must be an object' };
  }

  if (!operation.id || !operation.type || !operation.timestamp) {
    return { valid: false, error: 'Operation missing required fields' };
  }

  if (!Object.values(OperationType).includes(operation.type)) {
    return { valid: false, error: 'Invalid operation type' };
  }

  return { valid: true };
};

// Operation conflict resolution helpers
export const canOperationsConflict = (op1, op2) => {
  // Simple conflict detection - operations on same strokes
  const getStrokeIds = (op) => {
    if (op.payload.strokeId) return [op.payload.strokeId];
    if (op.payload.strokeIds) return op.payload.strokeIds;
    return [];
  };

  const ids1 = getStrokeIds(op1);
  const ids2 = getStrokeIds(op2);
  
  return ids1.some(id => ids2.includes(id));
};

export const resolveOperationConflict = (localOp, remoteOp) => {
  // Timestamp-based resolution - later operation wins
  if (remoteOp.timestamp > localOp.timestamp) {
    return { winner: remoteOp, loser: localOp };
  }
  return { winner: localOp, loser: remoteOp };
};