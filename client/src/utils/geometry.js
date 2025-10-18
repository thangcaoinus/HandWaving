// Computes the convex hull of a set of 2D points using Andrew's monotone chain algorithm.
// Returns the vertices of the convex polygon in counter-clockwise order.
// Time complexity: O(n log n) due to sorting
export function convexHull(points) {
  if (points.length < 3) return points;

  // Cross product to determine if three points make a counter-clockwise turn
  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x
  );

  const lower = [];
  for (let i = 0; i < sorted.length; i++) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0
    ) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0
    ) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Calculates perimeter of a rectangle given width and height
export function minEnclosingRectanglePerimeter(width, height) {
  return 2 * (width + height);
}

// Finds the minimum-area oriented bounding rectangle for a convex hull.
// Uses rotating calipers technique - tests each edge as potential rectangle side.
// Returns {corners: [{x,y}, ...], width, height, area, angle} or null if < 3 points.
export function minAreaBoundingRect(convexHull) {
  if (convexHull.length < 3) return null;

  let minArea = Infinity;
  let bestRect = null;

  // Test each edge of the convex hull as a potential side of the bounding rectangle
  for (let i = 0; i < convexHull.length; i++) {
    const p1 = convexHull[i];
    const p2 = convexHull[(i + 1) % convexHull.length];

    const edgeVector = { x: p2.x - p1.x, y: p2.y - p1.y };
    const edgeLength = Math.sqrt(
      edgeVector.x * edgeVector.x + edgeVector.y * edgeVector.y
    );

    if (edgeLength === 0) continue;

    const unitEdge = {
      x: edgeVector.x / edgeLength,
      y: edgeVector.y / edgeLength,
    };
    const perpendicular = { x: -unitEdge.y, y: unitEdge.x };

    let minProj = Infinity,
      maxProj = -Infinity;
    let minPerp = Infinity,
      maxPerp = -Infinity;

    for (const point of convexHull) {
      const projOnEdge =
        (point.x - p1.x) * unitEdge.x + (point.y - p1.y) * unitEdge.y;
      const projOnPerp =
        (point.x - p1.x) * perpendicular.x + (point.y - p1.y) * perpendicular.y;

      minProj = Math.min(minProj, projOnEdge);
      maxProj = Math.max(maxProj, projOnEdge);
      minPerp = Math.min(minPerp, projOnPerp);
      maxPerp = Math.max(maxPerp, projOnPerp);
    }

    const width = maxProj - minProj;
    const height = maxPerp - minPerp;
    const area = width * height;

    if (area < minArea) {
      minArea = area;

      const corner1 = {
        x: p1.x + minProj * unitEdge.x + minPerp * perpendicular.x,
        y: p1.y + minProj * unitEdge.y + minPerp * perpendicular.y,
      };
      const corner2 = {
        x: p1.x + maxProj * unitEdge.x + minPerp * perpendicular.x,
        y: p1.y + maxProj * unitEdge.y + minPerp * perpendicular.y,
      };
      const corner3 = {
        x: p1.x + maxProj * unitEdge.x + maxPerp * perpendicular.x,
        y: p1.y + maxProj * unitEdge.y + maxPerp * perpendicular.y,
      };
      const corner4 = {
        x: p1.x + minProj * unitEdge.x + maxPerp * perpendicular.x,
        y: p1.y + minProj * unitEdge.y + maxPerp * perpendicular.y,
      };

      bestRect = {
        area: minArea,
        width,
        height,
        perimeter: minEnclosingRectanglePerimeter(width, height),
        corners: [corner1, corner2, corner3, corner4],
      };
    }
  }

  return bestRect;
}

// Finds the largest triangle inscribed in a convex hull using brute force O(n³) search.
// Tests all combinations of 3 vertices to find maximum area triangle.
export function maxAreaTriangle(convexHull) {
  if (convexHull.length < 3) return null;

  let maxArea = 0;
  let bestTriangle = null;

  function triangleArea(p1, p2, p3) {
    return Math.abs(
      (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
    );
  }

  for (let i = 0; i < convexHull.length; i++) {
    for (let j = i + 1; j < convexHull.length; j++) {
      for (let k = j + 1; k < convexHull.length; k++) {
        const p1 = convexHull[i];
        const p2 = convexHull[j];
        const p3 = convexHull[k];

        const area = triangleArea(p1, p2, p3);

        if (area > maxArea) {
          maxArea = area;
          bestTriangle = {
            area: maxArea,
            vertices: [p1, p2, p3],
          };
        }
      }
    }
  }

  return bestTriangle;
}

// Calculates the perimeter of a convex hull by summing edge lengths
export function convexHullPerimeter(convexHull) {
  if (convexHull.length < 3) return 0;

  let perimeter = 0;

  for (let i = 0; i < convexHull.length; i++) {
    const p1 = convexHull[i];
    const p2 = convexHull[(i + 1) % convexHull.length];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    perimeter += distance;
  }

  return perimeter;
}

// Calculates the area of a convex hull using the shoelace formula
export function convexHullArea(convexHull) {
  if (convexHull.length < 3) return 0;

  let area = 0;

  for (let i = 0; i < convexHull.length; i++) {
    const p1 = convexHull[i];
    const p2 = convexHull[(i + 1) % convexHull.length];

    area += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(area) / 2;
}

// Computes the axis-aligned bounding box (AABB) for a set of points
export function computeBoundingBox(points) {
  if (!points || points.length === 0) {
    return null;
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    width,
    height,
  };
}

// Tests if a point is inside a bounding box, with optional padding for fuzzy hit detection
export function pointInBoundingBox(point, bbox, padding = 0) {
  if (!bbox || !point) return false;
  
  return (
    point.x >= bbox.minX - padding &&
    point.x <= bbox.maxX + padding &&
    point.y >= bbox.minY - padding &&
    point.y <= bbox.maxY + padding
  );
}

// Tests if two bounding boxes overlap (AABB intersection test)
export function rectangleIntersectsBoundingBox(rect, bbox) {
  if (!rect || !bbox) return false;
  
  return !(
    rect.maxX < bbox.minX ||
    rect.minX > bbox.maxX ||
    rect.maxY < bbox.minY ||
    rect.minY > bbox.maxY
  );
}

// Translates all points by the given offset
export function translatePoints(points, deltaX, deltaY) {
  return points.map(point => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
}

// Transform utilities for resize and rotate operations

// Scales points relative to an anchor point (allows non-uniform scaling)
export function resizePoints(points, anchorPoint, scaleX, scaleY) {
  return points.map(point => ({
    x: anchorPoint.x + (point.x - anchorPoint.x) * scaleX,
    y: anchorPoint.y + (point.y - anchorPoint.y) * scaleY,
  }));
}

// Scales points uniformly (same scale factor for x and y)
export function resizePointsUniform(points, anchorPoint, scaleFactor) {
  return resizePoints(points, anchorPoint, scaleFactor, scaleFactor);
}

// Rotates points around a center using 2D rotation matrix
export function rotatePoints(points, centerPoint, angleRadians) {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  return points.map(point => {
    const translatedX = point.x - centerPoint.x;
    const translatedY = point.y - centerPoint.y;
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;

    return {
      x: rotatedX + centerPoint.x,
      y: rotatedY + centerPoint.y,
    };
  });
}

// Calculates scale factors when dragging resize handles.
// Anchor point is the opposite corner/edge. Supports aspect ratio lock (Shift key).
// Returns {scaleX, scaleY, anchorPoint} for transform operations.
export function calculateScaleFromCorner(originalBbox, draggedPoint, handlePosition, maintainAspectRatio = false) {
  let scaleX = 1;
  let scaleY = 1;
  let anchorPoint = { x: 0, y: 0 };

  const originalWidth = originalBbox.maxX - originalBbox.minX;
  const originalHeight = originalBbox.maxY - originalBbox.minY;

  // Determine anchor point (opposite corner/edge from dragged handle)
  switch (handlePosition) {
    case 'nw':
      anchorPoint = { x: originalBbox.maxX, y: originalBbox.maxY };
      scaleX = (anchorPoint.x - draggedPoint.x) / originalWidth;
      scaleY = (anchorPoint.y - draggedPoint.y) / originalHeight;
      break;
    case 'ne':
      anchorPoint = { x: originalBbox.minX, y: originalBbox.maxY };
      scaleX = (draggedPoint.x - anchorPoint.x) / originalWidth;
      scaleY = (anchorPoint.y - draggedPoint.y) / originalHeight;
      break;
    case 'sw':
      anchorPoint = { x: originalBbox.maxX, y: originalBbox.minY };
      scaleX = (anchorPoint.x - draggedPoint.x) / originalWidth;
      scaleY = (draggedPoint.y - anchorPoint.y) / originalHeight;
      break;
    case 'se':
      anchorPoint = { x: originalBbox.minX, y: originalBbox.minY };
      scaleX = (draggedPoint.x - anchorPoint.x) / originalWidth;
      scaleY = (draggedPoint.y - anchorPoint.y) / originalHeight;
      break;
    case 'n':
      anchorPoint = { x: originalBbox.centerX, y: originalBbox.maxY };
      scaleY = (anchorPoint.y - draggedPoint.y) / originalHeight;
      break;
    case 's':
      anchorPoint = { x: originalBbox.centerX, y: originalBbox.minY };
      scaleY = (draggedPoint.y - anchorPoint.y) / originalHeight;
      break;
    case 'e':
      anchorPoint = { x: originalBbox.minX, y: originalBbox.centerY };
      scaleX = (draggedPoint.x - anchorPoint.x) / originalWidth;
      break;
    case 'w':
      anchorPoint = { x: originalBbox.maxX, y: originalBbox.centerY };
      scaleX = (anchorPoint.x - draggedPoint.x) / originalWidth;
      break;
  }
  
  // Maintain aspect ratio if requested (shift key)
  if (maintainAspectRatio && (handlePosition === 'nw' || handlePosition === 'ne' || handlePosition === 'sw' || handlePosition === 'se')) {
    const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
    scaleX = scaleX >= 0 ? scale : -scale;
    scaleY = scaleY >= 0 ? scale : -scale;
  }
  
  return { scaleX, scaleY, anchorPoint };
}

// Calculates rotation angle delta between two mouse positions relative to center point
export function calculateRotationAngle(centerPoint, previousMouse, currentMouse) {
  const previousAngle = Math.atan2(previousMouse.y - centerPoint.y, previousMouse.x - centerPoint.x);
  const currentAngle = Math.atan2(currentMouse.y - centerPoint.y, currentMouse.x - centerPoint.x);
  return currentAngle - previousAngle;
}

// Returns the center point of a bounding box
export function getBboxCenter(bbox) {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
}

// Lasso selection utilities

// Ray casting algorithm - shoots a horizontal ray from point and counts edge crossings.
// Odd number of crossings = inside polygon, even = outside.
export function isPointInPolygon(point, polygonPoints) {
  if (!point || !polygonPoints || polygonPoints.length < 3) {
    return false;
  }

  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].x;
    const yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x;
    const yj = polygonPoints[j].y;

    // Check if horizontal ray from point crosses this edge
    const intersect = ((yi > y) !== (yj > y)) &&
                     (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// Tests if two line segments (p1→p2) and (p3→p4) intersect using parametric line equations.
// Returns true if intersection point lies on both segments (0 ≤ ua, ub ≤ 1).
export function doLineSegmentsIntersect(p1, p2, p3, p4) {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (denominator === 0) return false; // Parallel lines

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

  // Intersection point must be within both segments
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Main lasso selection test - checks if a bbox overlaps with lasso polygon.
// Uses quick bbox rejection, then checks corner containment and edge intersections.
export function doesBboxIntersectPolygon(bbox, polygonPoints) {
  if (!bbox || !polygonPoints || polygonPoints.length < 3) {
    return false;
  }

  // Quick rejection: check if bboxes don't overlap at all
  const polygonBbox = computeBoundingBox(polygonPoints);
  if (!rectangleIntersectsBoundingBox(bbox, polygonBbox)) {
    return false;
  }

  // Define bbox corners
  const bboxCorners = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];

  // Check if any bbox corner is inside polygon
  for (const corner of bboxCorners) {
    if (isPointInPolygon(corner, polygonPoints)) {
      return true;
    }
  }

  // Define bbox edges
  const bboxEdges = [
    [bboxCorners[0], bboxCorners[1]], // top
    [bboxCorners[1], bboxCorners[2]], // right
    [bboxCorners[2], bboxCorners[3]], // bottom
    [bboxCorners[3], bboxCorners[0]], // left
  ];

  // Check if any bbox edge intersects polygon edges
  for (let i = 0; i < polygonPoints.length; i++) {
    const polyP1 = polygonPoints[i];
    const polyP2 = polygonPoints[(i + 1) % polygonPoints.length];

    for (const [bboxP1, bboxP2] of bboxEdges) {
      if (doLineSegmentsIntersect(bboxP1, bboxP2, polyP1, polyP2)) {
        return true;
      }
    }
  }

  // Check if polygon is entirely inside bbox (edge case)
  if (polygonPoints.length > 0) {
    const firstPoint = polygonPoints[0];
    if (pointInBoundingBox(firstPoint, bbox)) {
      return true;
    }
  }

  return false;
}

// Closes lasso path by connecting last point back to first (if not already within 5px)
export function closeLassoPath(points) {
  if (!points || points.length < 2) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];

  // Check if already closed (within 5px)
  const distance = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
  );

  if (distance < 5) {
    return [...points.slice(0, -1), first];
  }

  return [...points, first];
}

// Euclidean distance between two points
export function distanceBetweenPoints(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Evaluates a quadratic Bezier curve (3 control points) at parameter t ∈ [0,1]
export function quadraticBezier(p0, p1, p2, t) {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;

  return {
    x: oneMinusTSquared * p0.x + 2 * oneMinusT * t * p1.x + tSquared * p2.x,
    y: oneMinusTSquared * p0.y + 2 * oneMinusT * t * p1.y + tSquared * p2.y,
  };
}

// Evaluates a cubic Bezier curve (4 control points) at parameter t ∈ [0,1]
export function cubicBezier(p0, p1, p2, p3, t) {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const oneMinusTCubed = oneMinusTSquared * oneMinusT;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return {
    x: oneMinusTCubed * p0.x +
       3 * oneMinusTSquared * t * p1.x +
       3 * oneMinusT * tSquared * p2.x +
       tCubed * p3.x,
    y: oneMinusTCubed * p0.y +
       3 * oneMinusTSquared * t * p1.y +
       3 * oneMinusT * tSquared * p2.y +
       tCubed * p3.y,
  };
}

// Samples a quadratic Bezier curve into discrete points for rendering
export function generateQuadraticBezierPoints(p0, p1, p2, segments = 25) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(quadraticBezier(p0, p1, p2, t));
  }
  return points;
}

// Samples a cubic Bezier curve into discrete points for rendering
export function generateCubicBezierPoints(p0, p1, p2, p3, segments = 25) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(cubicBezier(p0, p1, p2, p3, t));
  }
  return points;
}

// Computes the tangent vector (first derivative) of a quadratic Bezier at parameter t
export function quadraticBezierDerivative(p0, p1, p2, t) {
  const oneMinusT = 1 - t;

  return {
    x: 2 * oneMinusT * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * oneMinusT * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

// Computes the tangent vector (first derivative) of a cubic Bezier at parameter t
export function cubicBezierDerivative(p0, p1, p2, p3, t) {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;

  return {
    x: 3 * oneMinusTSquared * (p1.x - p0.x) +
       6 * oneMinusT * t * (p2.x - p1.x) +
       3 * tSquared * (p3.x - p2.x),
    y: 3 * oneMinusTSquared * (p1.y - p0.y) +
       6 * oneMinusT * t * (p2.y - p1.y) +
       3 * tSquared * (p3.y - p2.y),
  };
}

// Vector utility functions

// Normalizes a vector to unit length (magnitude = 1)
export function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

// Calculates the angle of a vector in radians
export function vectorAngle(vector) {
  return Math.atan2(vector.y, vector.x);
}

// Analyzes how many times a curve changes direction (inflection points).
// Uses cross products to detect curvature sign changes. Returns {inflectionCount, isSimple, isComplex}.
export function analyzeCurveComplexity(points) {
  if (points.length < 3) return { inflectionCount: 0, isSimple: true, isComplex: false };

  let inflectionCount = 0;
  let prevCurvature = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    const v1x = p1.x - p0.x;
    const v1y = p1.y - p0.y;
    const v2x = p2.x - p1.x;
    const v2y = p2.y - p1.y;

    const crossProduct = v1x * v2y - v1y * v2x;

    if (i === 1) {
      prevCurvature = crossProduct;
      continue;
    }

    if (Math.sign(crossProduct) !== Math.sign(prevCurvature) && Math.abs(crossProduct) > 0.01) {
      inflectionCount++;
    }

    prevCurvature = crossProduct;
  }

  return {
    inflectionCount,
    isSimple: inflectionCount <= 1,
    isComplex: inflectionCount >= 3,
  };
}

// Fits a single cubic Bezier curve to a path by sampling control points at 25% and 75% positions.
// Simple heuristic for converting freehand strokes to smooth curves.
export function fitCubicBezierToPath(points) {
  if (points.length < 3) {
    return null;
  }

  const start = points[0];
  const end = points[points.length - 1];

  const quarterIndex = Math.floor(points.length / 4);
  const threeQuarterIndex = Math.floor((points.length * 3) / 4);

  const cp1Sample = points[quarterIndex];
  const cp2Sample = points[threeQuarterIndex];

  const cp1 = {
    x: cp1Sample.x,
    y: cp1Sample.y,
  };

  const cp2 = {
    x: cp2Sample.x,
    y: cp2Sample.y,
  };

  return { start, cp1, cp2, end };
}

// Fits multiple cubic Bezier segments to a complex path (e.g., curved arrows with inflections).
// Maintains C1 continuity at join points by aligning tangents between segments.
export function fitMultiSegmentBezierToPath(points, numSegments = 2) {
  if (points.length < 3) {
    return null;
  }

  const segments = [];
  const segmentSize = Math.floor(points.length / numSegments);

  for (let i = 0; i < numSegments; i++) {
    const segmentStart = i * segmentSize;
    const segmentEnd = (i === numSegments - 1) ? points.length - 1 : (i + 1) * segmentSize;
    
    const segmentPoints = points.slice(segmentStart, segmentEnd + 1);
    
    if (segmentPoints.length < 3) continue;

    const start = segmentPoints[0];
    const end = segmentPoints[segmentPoints.length - 1];
    
    const cp1Index = Math.floor(segmentPoints.length / 3);
    const cp2Index = Math.floor((segmentPoints.length * 2) / 3);
    
    let cp1 = segmentPoints[cp1Index];
    let cp2 = segmentPoints[cp2Index];

    if (i > 0 && segments.length > 0) {
      const prevSegment = segments[segments.length - 1];
      const joinPoint = start;
      
      const prevCp2 = prevSegment.cp2;
      const tangentX = joinPoint.x - prevCp2.x;
      const tangentY = joinPoint.y - prevCp2.y;
      
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      const desiredLength = Math.hypot(
        segmentPoints[cp1Index].x - joinPoint.x,
        segmentPoints[cp1Index].y - joinPoint.y
      );
      
      cp1 = {
        x: joinPoint.x + (tangentX / tangentLength) * desiredLength,
        y: joinPoint.y + (tangentY / tangentLength) * desiredLength,
      };
    }

    segments.push({ start, cp1, cp2, end });
  }

  return segments;
}