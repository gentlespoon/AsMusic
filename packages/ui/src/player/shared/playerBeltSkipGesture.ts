/** Mirrors legacy `PlayerBarView.swift` / belt gesture hooks. */
export const BELT_SWIPE_THRESHOLD = 28;
export const BELT_CANCEL_SLOP = 12;

export type BeltSkipGestureState = {
  armed: 'next' | 'previous' | null;
  cancelled: boolean;
};

export type BeltSkipGestureOptions = {
  hasNext: boolean;
  hasPrevious: boolean;
  swipeThreshold?: number;
  cancelSlop?: number;
};

export function createBeltSkipGestureState(): BeltSkipGestureState {
  return { armed: null, cancelled: false };
}

export function resetBeltSkipGestureState(state: BeltSkipGestureState): void {
  state.armed = null;
  state.cancelled = false;
}

export function updateBeltSkipGestureState(
  state: BeltSkipGestureState,
  h: number,
  v: number,
  opts: BeltSkipGestureOptions,
): void {
  if (state.cancelled) return;

  const swipeThreshold = opts.swipeThreshold ?? BELT_SWIPE_THRESHOLD;
  const cancelSlop = opts.cancelSlop ?? BELT_CANCEL_SLOP;

  if (state.armed === null) {
    if (Math.abs(h) <= Math.abs(v)) return;
    if (h <= -swipeThreshold && opts.hasNext) {
      state.armed = 'next';
    } else if (h >= swipeThreshold && opts.hasPrevious) {
      state.armed = 'previous';
    }
    return;
  }

  if (state.armed === 'next') {
    if (h > cancelSlop || Math.abs(h) <= cancelSlop) {
      state.cancelled = true;
    }
  } else if (state.armed === 'previous') {
    if (h < -cancelSlop || Math.abs(h) <= cancelSlop) {
      state.cancelled = true;
    }
  }
}

export function resolveBeltSkipCommit(
  state: BeltSkipGestureState,
  h: number,
  v: number,
  swipeThreshold: number = BELT_SWIPE_THRESHOLD,
): 'next' | 'previous' | null {
  if (state.cancelled || state.armed === null) return null;
  if (Math.abs(h) <= Math.abs(v)) return null;

  if (state.armed === 'next' && h <= -swipeThreshold) {
    return 'next';
  }
  if (state.armed === 'previous' && h >= swipeThreshold) {
    return 'previous';
  }
  return null;
}
