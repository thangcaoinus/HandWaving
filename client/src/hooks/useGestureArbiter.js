import { useRef } from "react";

// Multi-touch gesture arbiter.
//
// Sits at the top of useDraw's pointer dispatch. It only governs `pointerType === 'touch'`;
// mouse and pen fall straight through to the existing single-pointer router (so desktop is
// untouched and an Apple Pencil draws like a finger — the "pen = finger" decision).
//
// Routing by live touch count:
//   1 finger  → forwarded to the normal mode router (draw / select / transform / text just work,
//               since they read clientX/Y through getCanvasPoint). Tap + double-tap are detected here.
//   2 fingers → pinch-zoom + two-finger pan via viewport.pinchZoom. On the 1→2 transition any
//               in-progress single-finger action is ABORTED (not committed) via the mode cancels.
//   >2        → ignored (swallowed).
//
// After a gesture, single-finger input stays suppressed until ALL fingers lift — this prevents the
// leftover finger from suddenly drawing/selecting when the other lifts off a pinch.

const DOUBLE_TAP_MS = 300;
const TAP_MOVE_TOLERANCE = 12; // px of screen movement still considered a stationary tap
const DOUBLE_TAP_DIST = 24; // px between the two taps of a double-tap

export function useGestureArbiter({
  canvasRef,
  viewport,
  redrawCanvas,
  canvasHelpers,
  lastMousePosRef,
  // current tool flags
  isSelectMode,
  // mode cancels / abort (called when a 2nd finger escalates a single-finger action)
  abortSingleFingerAction,
  // tap synthesis targets
  selectAtPoint, // (canvasPoint, {additive}) => bool   — select top-most object under a tap
  handleDoubleTap, // (syntheticEvent) => {handled}       — textMode.handleDoubleClick
}) {
  const activePointers = useRef(new Map()); // pointerId -> { x, y } (screen/client coords)
  const gestureRef = useRef(null); // null | { prevDist, prevCentroid: {x,y} }
  const suppressUntilAllUpRef = useRef(false); // block single-finger after a gesture until fingers lift

  // Single-finger tap bookkeeping
  const tapCandidateRef = useRef(null); // { x, y, startX, startY, moved } for the lone active finger
  const lastTapRef = useRef(null); // { time, x, y } of the previous completed tap

  const rect = () => canvasRef.current?.getBoundingClientRect();
  const toLocal = (e) => {
    const r = rect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: e.clientX, y: e.clientY };
  };
  const centroidOf = (pts) => {
    let sx = 0, sy = 0;
    pts.forEach((p) => { sx += p.x; sy += p.y; });
    return { x: sx / pts.length, y: sy / pts.length };
  };
  const distOf = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const beginPinch = () => {
    const pts = [...activePointers.current.values()];
    gestureRef.current = {
      prevDist: distOf(pts[0], pts[1]) || 1,
      prevCentroid: centroidOf(pts),
    };
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return { handled: false };

    const local = toLocal(e);
    activePointers.current.set(e.pointerId, local);
    const count = activePointers.current.size;

    if (count >= 2) {
      // Escalation: a single-finger action may be in flight — discard it, don't commit garbage.
      if (count === 2) {
        abortSingleFingerAction?.();
        tapCandidateRef.current = null;
        beginPinch();
      }
      // Any 2nd+ finger down means the following lift should NOT resume single-finger input.
      suppressUntilAllUpRef.current = true;
      return { handled: true };
    }

    // Exactly one finger. If we're still suppressing after a prior gesture, swallow it.
    if (suppressUntilAllUpRef.current) return { handled: true };

    // Lone finger → let the normal router start (draw/marquee/move/text). Track it as a tap candidate.
    if (!isSelectMode) lastTapRef.current = null;
    const canvasPt = canvasHelpers.getCanvasPoint(e);
    if (canvasPt && lastMousePosRef) lastMousePosRef.current = canvasPt; // keep paste-at-cursor fresh
    tapCandidateRef.current = { x: local.x, y: local.y, startX: local.x, startY: local.y, moved: false };
    return { handled: false };
  };

  const onPointerMove = (e) => {
    if (e.pointerType !== "touch") return { handled: false };
    if (!activePointers.current.has(e.pointerId)) return { handled: false };

    const local = toLocal(e);
    activePointers.current.set(e.pointerId, local);

    // Two-finger gesture: continuous pinch-zoom + centroid pan.
    if (gestureRef.current && activePointers.current.size >= 2) {
      const pts = [...activePointers.current.values()];
      const curDist = distOf(pts[0], pts[1]) || 1;
      const curCentroid = centroidOf(pts);
      const g = gestureRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        viewport.pinchZoom(
          curCentroid.x, curCentroid.y,
          curCentroid.x - g.prevCentroid.x,
          curCentroid.y - g.prevCentroid.y,
          curDist, g.prevDist,
          canvas.width, canvas.height
        );
        redrawCanvas();
      }
      g.prevDist = curDist;
      g.prevCentroid = curCentroid;
      return { handled: true };
    }

    if (suppressUntilAllUpRef.current) return { handled: true };

    // Lone finger dragging → cancel the tap candidate once it moves past tolerance, let router draw.
    const tc = tapCandidateRef.current;
    if (tc && !tc.moved) {
      if (Math.hypot(local.x - tc.startX, local.y - tc.startY) > TAP_MOVE_TOLERANCE) tc.moved = true;
    }
    const canvasPt = canvasHelpers.getCanvasPoint(e);
    if (canvasPt && lastMousePosRef) lastMousePosRef.current = canvasPt;
    return { handled: false };
  };

  // Called by useDraw AFTER the normal router's pointerup, so tap-select wins over a zero-area marquee.
  const onPointerUp = (e) => {
    if (e.pointerType !== "touch") return { handled: false };

    const wasPinch = !!gestureRef.current;
    const local = toLocal(e);
    activePointers.current.delete(e.pointerId);
    const remaining = activePointers.current.size;

    if (wasPinch) {
      if (remaining < 2) gestureRef.current = null; // fell below two fingers → end pinch
      if (remaining === 0) suppressUntilAllUpRef.current = false; // fully lifted → re-enable single finger
      return { handled: true };
    }

    if (remaining === 0) suppressUntilAllUpRef.current = false;
    if (suppressUntilAllUpRef.current) return { handled: true };

    // A completed lone-finger interaction. Was it a stationary tap?
    const tc = tapCandidateRef.current;
    tapCandidateRef.current = null;
    if (!tc || tc.moved) return { handled: false };

    // Creation taps must never pair with a later selection tap to reopen existing text.
    if (!isSelectMode) {
      lastTapRef.current = null;
      return { handled: false };
    }

    const now = Date.now();
    const prev = lastTapRef.current;
    const isDouble =
      prev && now - prev.time < DOUBLE_TAP_MS &&
      Math.hypot(local.x - prev.x, local.y - prev.y) < DOUBLE_TAP_DIST;

    if (isDouble) {
      lastTapRef.current = null;
      // Synthesize the event shape handleDoubleClick expects (reads clientX/Y).
      const res = handleDoubleTap?.({ clientX: e.clientX, clientY: e.clientY, pointerType: "touch" });
      return res?.handled ? { handled: true } : { handled: false };
    }

    lastTapRef.current = { time: now, x: local.x, y: local.y };

    // Single tap in select mode → select the top-most object under the finger (replaces selection).
    if (isSelectMode) {
      const canvasPt = canvasHelpers.getCanvasPoint(e);
      if (canvasPt) selectAtPoint?.(canvasPt, { additive: false });
    }
    return { handled: false };
  };

  const onPointerCancel = (e) => {
    if (e.pointerType !== "touch") return { handled: false };
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) gestureRef.current = null;
    if (activePointers.current.size === 0) suppressUntilAllUpRef.current = false;
    tapCandidateRef.current = null;
    return { handled: true };
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
