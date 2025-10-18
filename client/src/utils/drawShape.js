import {
  convexHull,
  maxAreaTriangle,
  minAreaBoundingRect,
  generateQuadraticBezierPoints,
  generateCubicBezierPoints,
  quadraticBezierDerivative,
  cubicBezierDerivative,
  vectorAngle,
  analyzeCurveComplexity,
  fitMultiSegmentBezierToPath,
} from "./geometry";
import { logger } from './logger';

// Adaptively fits 2-4 Bezier segments to complex curved arrows based on inflection count.
// More inflections = more segments for better curve approximation (S-curves, U-curves, spirals).
export function createAdaptiveCurvedArrow(points, arrowHeadSize = 20) {
  if (!points || points.length < 3) return [];

  const complexity = analyzeCurveComplexity(points);
  const numSegments = Math.min(Math.max(2, Math.ceil(complexity.inflectionCount / 2) + 1), 4);
  const multiSegments = fitMultiSegmentBezierToPath(points, numSegments);
  
  return createMultiSegmentCurvedArrow(multiSegments, arrowHeadSize);
}

// Converts detected shapes from freehand strokes into perfect geometric versions.
// Routes to appropriate generator based on shape type (circle, rectangle, triangle, arrow variants).
export function snapIntoShape(shape) {
  logger.log("Detected shape:", shape.type);

  switch (shape.type) {
    case "line":
      return generatePerfectLine(shape.stroke);

    case "arrow": {
      const start = shape.stroke[0];
      const end = shape.stroke[shape.stroke.length - 1];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      const arrowHeadSize = Math.min(distance * 0.2, 30);
      return createArrow(start, end, arrowHeadSize);
    }

    case "curved-arrow": {
      const distance = Math.hypot(
        shape.stroke[shape.stroke.length - 1].x - shape.stroke[0].x,
        shape.stroke[shape.stroke.length - 1].y - shape.stroke[0].y
      );
      const arrowHeadSize = Math.min(distance * 0.2, 30);

      if (shape.originalPoints) {
        return createAdaptiveCurvedArrow(shape.originalPoints, arrowHeadSize);
      } else if (shape.multiSegments) {
        return createMultiSegmentCurvedArrow(shape.multiSegments, arrowHeadSize);
      } else if (shape.cubicControlPoints) {
        return createCubicCurvedArrow(
          shape.stroke[0],
          shape.cubicControlPoints.cp1,
          shape.cubicControlPoints.cp2,
          shape.stroke[shape.stroke.length - 1],
          arrowHeadSize
        );
      } else {
        return createCurvedArrowWithControlPoint(
          shape.stroke[0],
          shape.stroke[shape.stroke.length - 1],
          shape.controlPoint,
          arrowHeadSize
        );
      }
    }

    case "circle":
      return generatePerfectCircle(shape.stroke);

    case "rectangle":
      return generatePerfectRectangle(shape.stroke);

    case "triangle":
      return generatePerfectTriangle(shape.stroke);

    default:
      return shape.stroke;
  }
}

// Reusable shape generation functions

// Creates a line from start to end point
export function createLine(start, end) {
  return [start, end];
}

// Generates a circle as a polygon with configurable segment count (default 64 for smoothness)
export function createCircle(center, radius, segments = 64) {
  const circlePoints = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    circlePoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return circlePoints;
}

// Creates a closed rectangle from diagonal corners
export function createRectangle(topLeft, bottomRight) {
  return [
    topLeft,
    { x: bottomRight.x, y: topLeft.y },
    bottomRight,
    { x: topLeft.x, y: bottomRight.y },
    topLeft,
  ];
}

// Creates a closed triangle from three vertices
export function createTriangle(p1, p2, p3) {
  return [p1, p2, p3, p1];
}

// Creates a straight arrow with two-sided arrowhead (30° angle)
export function createArrow(start, end, arrowHeadSize = 20) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);

  const arrowHeadLength = arrowHeadSize;

  const arrowPoint1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
  };

  const arrowPoint2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
  };

  return [
    start,
    end,
    arrowPoint1,
    end,
    arrowPoint2,
  ];
}

// Creates a simple curved arrow using quadratic Bezier with perpendicular control point offset
export function createCurvedArrow(start, end, arrowHeadSize = 20, curvature = 0.3) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  const perpX = -dy / distance;
  const perpY = dx / distance;

  const curveOffset = distance * curvature;
  const controlPoint = {
    x: midX + perpX * curveOffset,
    y: midY + perpY * curveOffset,
  };

  const curvePoints = generateQuadraticBezierPoints(start, controlPoint, end, 25);

  const tangent = quadraticBezierDerivative(start, controlPoint, end, 1.0);
  const angle = vectorAngle(tangent);

  const arrowHeadLength = arrowHeadSize;
  const arrowPoint1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
  };

  const arrowPoint2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
  };

  return [
    ...curvePoints,
    arrowPoint1,
    end,
    arrowPoint2,
  ];
}

// Creates a curved arrow using an explicit control point (from shape detection)
export function createCurvedArrowWithControlPoint(start, end, controlPoint, arrowHeadSize = 20) {
  const curvePoints = generateQuadraticBezierPoints(start, controlPoint, end, 25);

  const tangent = quadraticBezierDerivative(start, controlPoint, end, 1.0);
  const angle = vectorAngle(tangent);

  const arrowHeadLength = arrowHeadSize;
  const arrowPoint1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
  };

  const arrowPoint2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
  };

  return [
    ...curvePoints,
    arrowPoint1,
    end,
    arrowPoint2,
  ];
}

// Creates a curved arrow using cubic Bezier (4 control points)
export function createCubicCurvedArrow(start, cp1, cp2, end, arrowHeadSize = 20) {
  const curvePoints = generateCubicBezierPoints(start, cp1, cp2, end, 30);

  const tangent = cubicBezierDerivative(start, cp1, cp2, end, 1.0);
  const angle = vectorAngle(tangent);

  const arrowHeadLength = arrowHeadSize;
  const arrowPoint1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
  };

  const arrowPoint2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
  };

  return [
    ...curvePoints,
    arrowPoint1,
    end,
    arrowPoint2,
  ];
}

// Creates a complex curved arrow from multiple Bezier segments with C1 continuity.
// Trims curve by 60% of arrowhead length to prevent arrowhead collision with curve.
export function createMultiSegmentCurvedArrow(segments, arrowHeadSize = 20) {
  if (!segments || segments.length === 0) return [];

  let allCurvePoints = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentPoints = generateCubicBezierPoints(
      segment.start,
      segment.cp1,
      segment.cp2,
      segment.end,
      20
    );

    if (i === 0) {
      allCurvePoints = [...segmentPoints];
    } else {
      allCurvePoints = [...allCurvePoints, ...segmentPoints.slice(1)];
    }
  }

  const lastSegment = segments[segments.length - 1];
  const end = lastSegment.end;
  const arrowHeadLength = arrowHeadSize;
  
  let trimmedCurve = [...allCurvePoints];
  let cumulativeLength = 0;
  let newEnd = end;
  
  for (let i = trimmedCurve.length - 1; i > 0; i--) {
    const dist = Math.hypot(
      trimmedCurve[i].x - trimmedCurve[i - 1].x,
      trimmedCurve[i].y - trimmedCurve[i - 1].y
    );
    cumulativeLength += dist;
    
    if (cumulativeLength >= arrowHeadLength * 0.6) {
      newEnd = trimmedCurve[i - 1];
      trimmedCurve = trimmedCurve.slice(0, i);
      break;
    }
  }

  let angle;
  if (trimmedCurve.length >= 2) {
    const lastPoint = trimmedCurve[trimmedCurve.length - 1];
    const secondLastPoint = trimmedCurve[trimmedCurve.length - 2];
    const dx = lastPoint.x - secondLastPoint.x;
    const dy = lastPoint.y - secondLastPoint.y;
    angle = Math.atan2(dy, dx);
  } else {
    const tangent = cubicBezierDerivative(
      lastSegment.start,
      lastSegment.cp1,
      lastSegment.cp2,
      lastSegment.end,
      1.0
    );
    angle = vectorAngle(tangent);
  }

  const arrowPoint1 = {
    x: newEnd.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: newEnd.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
  };

  const arrowPoint2 = {
    x: newEnd.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: newEnd.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
  };

  return [
    ...trimmedCurve,
    arrowPoint1,
    newEnd,
    arrowPoint2,
  ];
}

function generatePerfectLine(points) {
  if (points.length < 2) return points;
  const start = points[0];
  const end = points[points.length - 1];
  return createLine(start, end);
}

function generatePerfectCircle(points) {
  if (points.length < 3) return points;

  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };

  const avgRadius =
    points.reduce((sum, p) => {
      const dist = Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2);
      return sum + dist;
    }, 0) / points.length;

  return createCircle(center, avgRadius);
}

function generatePerfectRectangle(points) {
  if (points.length < 4) return points;

  const hull = convexHull(points);
  const rect = minAreaBoundingRect(hull);

  if (rect && rect.corners.length >= 4) {
    return [...rect.corners, rect.corners[0]];
  }

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  return createRectangle(
    { x: minX, y: minY },
    { x: maxX, y: maxY }
  );
}

function generatePerfectTriangle(points) {
  if (points.length < 3) return points;

  const hull = convexHull(points);
  const triangle = maxAreaTriangle(hull);

  if (triangle && triangle.vertices.length >= 3) {
    return createTriangle(
      triangle.vertices[0],
      triangle.vertices[1],
      triangle.vertices[2]
    );
  }

  return points;
}
