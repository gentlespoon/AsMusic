import { useEffect, useRef } from 'react';

const Belt = {
  swipeThreshold: 28,
  quickSwipeCommitSlop: 12,
} as const;

export type PlayerCoverBeltGestureOptions = {
  enabled: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  onDrag?: (deltaPx: number) => void;
  onDragEnd?: () => void;
  skipNext: () => void | Promise<void>;
  skipPrevious: () => void | Promise<void>;
  playImpact?: () => void;
};

export function usePlayerCoverBeltGestures(opts: PlayerCoverBeltGestureOptions): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const draggingRef = useRef(false);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);

  const endDrag = () => {
    if (draggingRef.current) {
      optsRef.current.onDragEnd?.();
    }
    draggingRef.current = false;
    activePointerIdRef.current = null;
  };

  useEffect(() => () => endDrag(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* already captured */
    }
    draggingRef.current = false;
    activePointerIdRef.current = e.pointerId;
    originXRef.current = e.clientX;
    originYRef.current = e.clientY;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current) return;
    const h = e.clientX - originXRef.current;
    const v = e.clientY - originYRef.current;

    if (!draggingRef.current) {
      if (
        Math.abs(h) > Belt.quickSwipeCommitSlop &&
        Math.abs(h) > Math.abs(v)
      ) {
        draggingRef.current = true;
      } else {
        return;
      }
    }

    optsRef.current.onDrag?.(h);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }

    const h = e.clientX - originXRef.current;
    const v = e.clientY - originYRef.current;
    const o = optsRef.current;
    const wasDragging = draggingRef.current;

    if (wasDragging) {
      o.onDragEnd?.();
      const wantsSkipNext =
        Math.abs(h) > Math.abs(v) && h < -Belt.swipeThreshold && o.hasNext;
      const wantsSkipPrevious =
        Math.abs(h) > Math.abs(v) && h > Belt.swipeThreshold && o.hasPrevious;
      if (wantsSkipNext || wantsSkipPrevious) {
        o.playImpact?.();
      }
      if (wantsSkipNext) {
        void o.skipNext();
      } else if (wantsSkipPrevious) {
        void o.skipPrevious();
      }
    }

    draggingRef.current = false;
    activePointerIdRef.current = null;
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.pointerId !== activePointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    endDrag();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
