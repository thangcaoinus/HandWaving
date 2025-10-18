import React from "react";
import { simplify, refineEndpoints, strokeClosingFilter } from "./simplify";
import {
  convexHull,
  minAreaBoundingRect,
  maxAreaTriangle,
  convexHullPerimeter,
  convexHullArea,
  analyzeCurveComplexity,
} from "./geometry";

// Smart shape detection - identifies circles, rectangles, triangles, and arrows from freehand strokes.
// Uses dual-check algorithm: distance > 20px AND endpoint ratio > 30% to determine open vs closed.
// Priority order for closed shapes: triangle → rectangle → circle, with fallback to arrow for high aspect ratios.
export default function detectShape(points) {
  const originalPoints = points;
  
  const precision = 4;
  const simplified = simplify(points, precision);
  const refined = refineEndpoints(simplified);

  const n = refined.length;
  const startToEndDist = Math.hypot(
    refined[0].x - refined[n - 1].x,
    refined[0].y - refined[n - 1].y
  );

  let pathLength = 0;
  for (let i = 1; i < n; i++) {
    pathLength += Math.hypot(
      refined[i].x - refined[i - 1].x,
      refined[i].y - refined[i - 1].y
    );
  }

  const endpointRatio = startToEndDist / pathLength;
  const isOpen = startToEndDist > 20 && endpointRatio > 0.3;

  let stroke;

  if (isOpen) {
    stroke = refined;
    const curvature = analyzeCurvature(stroke);

    if (!curvature.isStraight) {
      return {
        stroke,
        type: "curved-arrow",
        originalPoints,
      };
    } else {
      return { stroke, type: "arrow" };
    }
  }

  // Closed shape - apply closing filter
  stroke = strokeClosingFilter(refined);
  
  // Check complexity BEFORE trying closed shape detection (use original points)
  const complexity = analyzeCurveComplexity(originalPoints);
  
  // If it has multiple inflections but doesn't close nicely, it's probably a complex arrow
  if (complexity.isComplex || complexity.inflectionCount >= 2) {
    const feature = extractFeature(stroke);
    
    // Check if we have valid features for shape detection
    if (!feature.enclosedTri || !feature.enclosingRec) {
      return {
        stroke: refined,
        type: "curved-arrow",
        originalPoints,
      };
    }
    
    // Only treat as closed shape if it clearly matches one
    const isTriangle = feature.enclosedTri.area / feature.convexA >= 0.9;
    const isRectangle = feature.convexP / feature.enclosingRec.perimeter >= 0.9;
    const isCircle = (feature.convexP * feature.convexP) / feature.convexA <= 15;
    
    if (!isTriangle && !isRectangle && !isCircle) {
      return {
        stroke: refined,
        type: "curved-arrow",
        originalPoints,
      };
    }
  }
  
  const feature = extractFeature(stroke);

  // Detect closed shapes in priority order
  
  // Check if we have enough data for shape detection
  if (!feature.enclosedTri || !feature.enclosingRec) {
    return { stroke, type: "gibberish" };
  }

  if (feature.enclosedTri.area / feature.convexA >= 0.9) {
    return { stroke, type: "triangle" };
  }

  // Rectangle detection with aspect ratio check
  if (feature.convexP / feature.enclosingRec.perimeter >= 0.9) {
    const rect = feature.enclosingRec;

    if (rect && rect.width && rect.height) {
      const aspectRatio =
        Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height);

      // If aspect ratio > 5, it's too thin - probably meant to be an arrow
      if (aspectRatio > 5) {
        return { stroke, type: "arrow" };
      }

      return { stroke, type: "rectangle" };
    }
  }

  if ((feature.convexP * feature.convexP) / feature.convexA <= 15) {
    return { stroke, type: "circle" };
  }

  return { stroke, type: "gibberish" };
}

// Extracts geometric features from a stroke for shape classification.
// Computes convex hull metrics: enclosing rectangle, enclosed triangle, perimeter, and area.
function extractFeature(points) {
  const convexSet = convexHull(points);

  const enclosingRec = minAreaBoundingRect(convexSet);
  const enclosedTri = maxAreaTriangle(convexSet);

  const convexP = convexHullPerimeter(convexSet);
  const convexA = convexHullArea(convexSet);

  return { enclosingRec, enclosedTri, convexP, convexA };
}

// Calculates perpendicular distance from point to line segment (for finding curved arrow control points)
function getPerpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    (dx * dx + dy * dy);
  const nearest = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
  return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

// Determines if a stroke is straight or curved by comparing path length to direct distance.
// Straightness ratio > 0.95 = straight arrow, otherwise curved arrow.
// Also finds optimal control point (max perpendicular distance from line) for Bezier fitting.
export function analyzeCurvature(points) {
  const start = points[0];
  const end = points[points.length - 1];

  // Calculate straight-line distance
  const straightDist = Math.hypot(end.x - start.x, end.y - start.y);

  // Calculate path length
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }

  const straightnessRatio = straightDist / pathLength;
  const isStraight = straightnessRatio > 0.95;

  // Find control point for curved arrows (point with max perpendicular distance)
  let maxDist = 0;
  let maxDistPoint = null;

  for (const point of points) {
    const dist = getPerpendicularDistance(point, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxDistPoint = point;
    }
  }

  return {
    isStraight,
    controlPoint: maxDistPoint,
    curvature: 1 - straightnessRatio,
  };
}
