// Coarse-pointer detection for touch-friendly hit targets.
// Prefer the event's own pointerType (accurate per-interaction: a stylus/finger reports 'touch'/'pen'
// even on a hybrid device), and fall back to a media query when the field is absent (plain MouseEvent).

const coarseMedia =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(pointer: coarse)")
    : null;

// True when the given event came from a finger or pen (the pointers that need bigger hit targets).
export function isCoarsePointerEvent(e) {
  if (e && typeof e.pointerType === "string") {
    return e.pointerType === "touch" || e.pointerType === "pen";
  }
  return !!coarseMedia?.matches;
}

// Device-level hint (no event handy) — used for conditional UI sizing.
export function deviceHasCoarsePointer() {
  return !!coarseMedia?.matches || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
}

// How much to inflate resize/rotate handle hit boxes for coarse pointers.
export const COARSE_HANDLE_HIT_SCALE = 2.5;
