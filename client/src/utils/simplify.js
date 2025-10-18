// Ramer-Douglas-Peucker algorithm for stroke simplification

// Calculates perpendicular distance from point to line segment
function getPerpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearest = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
  return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

// Simplifies a stroke using Ramer-Douglas-Peucker algorithm.
// Recursively removes points that contribute less than epsilon to the overall shape.
export function simplify(points, epsilon = 4) {
  if (points.length < 3) return points;

  let maxDist = 0;
  let index = -1;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = getPerpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  if (maxDist > epsilon) {
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [start, end];
  }
}

// Refines stroke endpoints by averaging nearby points for more accurate shape detection.
// Looks B pixels backward from endpoints, averages M closest points.
export function refineEndpoints(points, B = 15, M = 5) {
  if (points.length <= 2) return points;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const averagePoint = (pts) => {
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  };

  // Trim start
  let startBin = [points[0]];
  for (let i = 1; i < points.length && startBin.length < M; i++) {
    if (dist(points[i], startBin[startBin.length - 1]) <= B) {
      startBin.push(points[i]);
    } else break;
  }
  const Astart = averagePoint(startBin);

  // Trim end
  let endBin = [points[points.length - 1]];
  for (let i = points.length - 2; i >= 0 && endBin.length < M; i--) {
    if (dist(points[i], endBin[endBin.length - 1]) <= B) {
      endBin.push(points[i]);
    } else break;
  }
  const Aend = averagePoint(endBin);

  const newPoints = [Astart];
  newPoints.push(...points.slice(startBin.length, points.length - endBin.length));
  newPoints.push(Aend);

  return newPoints;
}

function lineIntersection(p1, p2, q1, q2) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  const { x: x3, y: y3 } = q1;
  const { x: x4, y: y4 } = q2;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (denominator === 0) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;

  // Compute intersection on the infinite line for p1-p2
  const ix = Math.floor(x1 + t * (x2 - x1));
  const iy = Math.floor(y1 + t * (y2 - y1));

  return { x: ix, y: iy };
}

// Closes a stroke if endpoints are within 60px threshold by finding line intersection.
// Prevents false closures for arrows while allowing easy closed shape detection.
export function strokeClosingFilter(points) {
  const n = points.length;

  if (n < 3) return points;

  // Calculate start-to-end distance
  const startToEndDist = Math.hypot(
    points[0].x - points[n - 1].x,
    points[0].y - points[n - 1].y
  );

  // Fixed threshold: 60 pixels - loose enough for easy closed shapes, clear for arrows
  const closingThreshold = 60;

  if (startToEndDist > closingThreshold) {
    // Stroke is OPEN - don't force it closed
    return points;
  }

  // Stroke is CLOSED - apply intersection logic to close it cleanly
  const intersect = lineIntersection(points[0], points[1], points[n - 1], points[n - 2]);

  if (intersect === null) return points;
  else return [intersect, ...points.slice(1, n - 1), intersect];
}

