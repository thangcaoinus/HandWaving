// Handle utilities for resize and rotate operations

export const HANDLE_SIZE = 8; // pixels
export const ROTATION_HANDLE_OFFSET = 30; // pixels above bbox

// Calculates positions for all 8 resize handles (4 corners + 4 edges) and rotation handle
export function getHandlePositions(bbox) {
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  
  return {
    // Corner handles
    nw: { x: bbox.minX, y: bbox.minY },
    ne: { x: bbox.maxX, y: bbox.minY },
    sw: { x: bbox.minX, y: bbox.maxY },
    se: { x: bbox.maxX, y: bbox.maxY },
    
    // Edge handles
    n: { x: centerX, y: bbox.minY },
    s: { x: centerX, y: bbox.maxY },
    e: { x: bbox.maxX, y: centerY },
    w: { x: bbox.minX, y: centerY },
    
    // Rotation handle
    rotate: { x: centerX, y: bbox.minY - ROTATION_HANDLE_OFFSET }
  };
}

// Detects which handle (if any) is under the mouse cursor.
// Uses zoom-aware hit testing - handle size scales with zoom level for consistent clickability.
export function detectHandle(mousePoint, bbox, currentZoom) {
  const handles = getHandlePositions(bbox);
  const effectiveHandleSize = HANDLE_SIZE / currentZoom;
  
  // Check rotation handle first (highest priority)
  if (isPointInHandle(mousePoint, handles.rotate, effectiveHandleSize)) {
    return {
      type: 'rotate',
      position: 'rotate',
      anchorPoint: { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 }
    };
  }
  
  // Check corner handles next
  const corners = ['nw', 'ne', 'sw', 'se'];
  for (const corner of corners) {
    if (isPointInHandle(mousePoint, handles[corner], effectiveHandleSize)) {
      return {
        type: 'resize',
        position: corner,
        anchorPoint: getAnchorPoint(bbox, corner)
      };
    }
  }
  
  // Check edge handles last
  const edges = ['n', 's', 'e', 'w'];
  for (const edge of edges) {
    if (isPointInHandle(mousePoint, handles[edge], effectiveHandleSize)) {
      return {
        type: 'resize',
        position: edge,
        anchorPoint: getAnchorPoint(bbox, edge)
      };
    }
  }
  
  return null;
}

export function isPointInHandle(point, handleCenter, handleSize) {
  const halfSize = handleSize / 2;
  return (
    point.x >= handleCenter.x - halfSize &&
    point.x <= handleCenter.x + halfSize &&
    point.y >= handleCenter.y - halfSize &&
    point.y <= handleCenter.y + halfSize
  );
}

function getAnchorPoint(bbox, handlePosition) {
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  
  switch (handlePosition) {
    case 'nw': return { x: bbox.maxX, y: bbox.maxY };
    case 'ne': return { x: bbox.minX, y: bbox.maxY };
    case 'sw': return { x: bbox.maxX, y: bbox.minY };
    case 'se': return { x: bbox.minX, y: bbox.minY };
    case 'n': return { x: centerX, y: bbox.maxY };
    case 's': return { x: centerX, y: bbox.minY };
    case 'e': return { x: bbox.minX, y: centerY };
    case 'w': return { x: bbox.maxX, y: centerY };
    default: return { x: centerX, y: centerY };
  }
}

export function drawResizeHandles(ctx, bbox) {
  const handles = getHandlePositions(bbox);
  const handleSize = HANDLE_SIZE;
  const halfSize = handleSize / 2;
  
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#007acc';
  ctx.lineWidth = 1;
  
  // Draw all resize handles (corners + edges)
  const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  resizeHandles.forEach(handleName => {
    const handle = handles[handleName];
    ctx.fillRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize);
    ctx.strokeRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize);
  });
  
  ctx.restore();
}

export function drawRotationHandle(ctx, bbox) {
  const handles = getHandlePositions(bbox);
  const rotateHandle = handles.rotate;
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const handleRadius = HANDLE_SIZE / 2;
  
  ctx.save();
  
  // Draw connection line from bbox to handle
  ctx.strokeStyle = '#28a745';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(centerX, bbox.minY);
  ctx.lineTo(rotateHandle.x, rotateHandle.y);
  ctx.stroke();
  
  // Draw rotation handle circle
  ctx.setLineDash([]);
  ctx.fillStyle = '#28a745';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(rotateHandle.x, rotateHandle.y, handleRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  
  ctx.restore();
}

// Returns appropriate CSS cursor style for each handle type/position
export function getCursorForHandle(handleType, handlePosition) {
  if (handleType === 'rotate') {
    return 'grab';
  }
  
  if (handleType === 'resize') {
    switch (handlePosition) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      default:
        return 'default';
    }
  }
  
  return 'default';
}