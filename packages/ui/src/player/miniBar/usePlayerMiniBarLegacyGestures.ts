import { useEffect, useRef } from "react";
import {
  BELT_CANCEL_SLOP,
  createBeltSkipGestureState,
  resetBeltSkipGestureState,
  resolveBeltSkipCommit,
  updateBeltSkipGestureState,
} from "@ui/player/shared/playerBeltSkipGesture";

/** Mirrors thresholds from legacy `PlayerBarView.swift` (Bar enum). */
const Bar = {
  swipeThreshold: 28,
  tapMaxDistance: 10,
  longPressMs: 380,
  quickSwipeCommitSlop: BELT_CANCEL_SLOP,
  scrubSeekThrottleMs: 120,
} as const;

type BarDragPhase = "undecided" | "carousel" | "seeking";

export type PlayerMiniBarLegacyGestureOptions = {
  enabled: boolean;
  busy: boolean;
  durationSeconds: number;
  positionSeconds: number;
  hasNext: boolean;
  hasPrevious: boolean;
  zoneWidthPx: number;
  togglePlayPause: () => void | Promise<void>;
  skipNext: () => void | Promise<void>;
  skipPrevious: () => void | Promise<void>;
  openFullPlayer: () => void;
  seek: (positionSeconds: number) => void | Promise<void>;
  /** Fires after a discrete gesture action (used to suppress stray synthetic clicks). */
  onGestureCommit?: () => void;
  /** Horizontal carousel drag while the belt is being pulled (gesture mode). */
  onCarouselDrag?: (deltaPx: number) => void;
  onCarouselDragEnd?: () => void;
  playImpact?: () => void;
};

export function usePlayerMiniBarLegacyGestures(
  opts: PlayerMiniBarLegacyGestureOptions,
): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const phaseRef = useRef<BarDragPhase>("undecided");
  const startTimeRef = useRef(0);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const latestHRef = useRef(0);
  const latestVRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekPivotXRef = useRef(0);
  const seekPivotTimeRef = useRef(0);
  const lastSeekAtRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const scrubDisplayRef = useRef<number | null>(null);
  const skipStateRef = useRef(createBeltSkipGestureState());

  const clearLongPress = () => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const endCarouselDrag = () => {
    optsRef.current.onCarouselDragEnd?.();
  };

  const resetGesture = () => {
    clearLongPress();
    if (phaseRef.current === "carousel") {
      endCarouselDrag();
    }
    phaseRef.current = "undecided";
    activePointerIdRef.current = null;
    scrubDisplayRef.current = null;
    resetBeltSkipGestureState(skipStateRef.current);
  };

  const updateSkipState = (h: number, v: number) => {
    const o = optsRef.current;
    updateBeltSkipGestureState(skipStateRef.current, h, v, {
      hasNext: o.hasNext,
      hasPrevious: o.hasPrevious,
    });
  };

  useEffect(() => () => clearLongPress(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* already captured */
    }
    activePointerIdRef.current = e.pointerId;
    phaseRef.current = "undecided";
    startTimeRef.current = performance.now();
    originXRef.current = e.clientX;
    originYRef.current = e.clientY;
    latestHRef.current = 0;
    latestVRef.current = 0;
    resetBeltSkipGestureState(skipStateRef.current);

    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      if (phaseRef.current !== "undecided") return;
      const o = optsRef.current;
      if (!o.enabled || !o.busy || o.durationSeconds <= 0) return;
      o.playImpact?.();
      phaseRef.current = "seeking";
      seekPivotXRef.current = latestHRef.current;
      seekPivotTimeRef.current = o.positionSeconds;
      lastSeekAtRef.current = 0;
      const d = o.durationSeconds;
      if (d <= 0) return;
      const clamped = Math.min(Math.max(0, seekPivotTimeRef.current), d);
      scrubDisplayRef.current = clamped;
      lastSeekAtRef.current = performance.now();
      void o.seek(clamped);
    }, Bar.longPressMs);
  };

  const commit = () => {
    optsRef.current.onGestureCommit?.();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current)
      return;
    const h = e.clientX - originXRef.current;
    const v = e.clientY - originYRef.current;
    latestHRef.current = h;
    latestVRef.current = v;

    if (phaseRef.current === "seeking") {
      const o = optsRef.current;
      const barW = Math.max(o.zoneWidthPx, 1);
      const deltaX = h - seekPivotXRef.current;
      const t = seekPivotTimeRef.current + (deltaX / barW) * o.durationSeconds;
      const d = o.durationSeconds;
      if (d <= 0) return;
      const clamped = Math.min(Math.max(0, t), d);
      scrubDisplayRef.current = clamped;
      const now = performance.now();
      if (now - lastSeekAtRef.current >= Bar.scrubSeekThrottleMs) {
        lastSeekAtRef.current = now;
        void o.seek(clamped);
      }
      return;
    }

    if (phaseRef.current === "carousel") {
      updateSkipState(h, v);
      optsRef.current.onCarouselDrag?.(h);
      return;
    }

    const elapsed = performance.now() - startTimeRef.current;
    if (
      elapsed < Bar.longPressMs &&
      Math.abs(h) > Bar.quickSwipeCommitSlop &&
      Math.abs(h) > Math.abs(v)
    ) {
      clearLongPress();
      phaseRef.current = "carousel";
      updateSkipState(h, v);
      optsRef.current.onCarouselDrag?.(h);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current)
      return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }

    const h = e.clientX - originXRef.current;
    const v = e.clientY - originYRef.current;
    const dist = Math.hypot(h, v);
    const elapsed = performance.now() - startTimeRef.current;
    const phase = phaseRef.current;
    const o = optsRef.current;

    clearLongPress();

    const wantsPresentPlayer = () =>
      Math.abs(h) <= Math.abs(v) && v < -Bar.swipeThreshold;

    if (phase === "seeking") {
      const d = o.durationSeconds;
      if (d > 0) {
        o.playImpact?.();
        const finalT = scrubDisplayRef.current ?? o.positionSeconds;
        void o.seek(Math.min(Math.max(0, finalT), d));
        commit();
      }
      resetGesture();
      return;
    }

    if (phase === "carousel") {
      endCarouselDrag();
      if (wantsPresentPlayer()) {
        o.openFullPlayer();
        commit();
      } else {
        const skipCommit = resolveBeltSkipCommit(skipStateRef.current, h, v);
        if (skipCommit === "next") {
          void o.skipNext();
          commit();
        } else if (skipCommit === "previous") {
          void o.skipPrevious();
          commit();
        }
      }
      phaseRef.current = "undecided";
      activePointerIdRef.current = null;
      scrubDisplayRef.current = null;
      resetBeltSkipGestureState(skipStateRef.current);
      return;
    }

    if (dist <= Bar.tapMaxDistance && elapsed < Bar.longPressMs) {
      if (o.busy) {
        void o.togglePlayPause();
        commit();
      }
      resetGesture();
      return;
    }
    if (wantsPresentPlayer()) {
      o.openFullPlayer();
      commit();
    }
    resetGesture();
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current)
      return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    clearLongPress();
    resetGesture();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
