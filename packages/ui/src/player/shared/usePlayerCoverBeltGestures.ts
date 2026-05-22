import { useEffect, useRef } from 'react';
import {
  BELT_CANCEL_SLOP,
  createBeltSkipGestureState,
  resetBeltSkipGestureState,
  resolveBeltSkipCommit,
  updateBeltSkipGestureState,
} from './playerBeltSkipGesture';

const Belt = {
  quickSwipeCommitSlop: BELT_CANCEL_SLOP,
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
  const skipStateRef = useRef(createBeltSkipGestureState());

  const endDrag = () => {
    if (draggingRef.current) {
      optsRef.current.onDragEnd?.();
    }
    draggingRef.current = false;
    activePointerIdRef.current = null;
    resetBeltSkipGestureState(skipStateRef.current);
  };

  useEffect(() => () => endDrag(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!optsRef.current.enabled || e.button !== 0) return;
    draggingRef.current = false;
    activePointerIdRef.current = e.pointerId;
    originXRef.current = e.clientX;
    originYRef.current = e.clientY;
    resetBeltSkipGestureState(skipStateRef.current);
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
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* already captured */
        }
      } else {
        return;
      }
    }

    const o = optsRef.current;
    updateBeltSkipGestureState(skipStateRef.current, h, v, {
      hasNext: o.hasNext,
      hasPrevious: o.hasPrevious,
    });
    o.onDrag?.(h);
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
      const commit = resolveBeltSkipCommit(skipStateRef.current, h, v);
      if (commit) {
        o.playImpact?.();
        if (commit === 'next') {
          void o.skipNext();
        } else {
          void o.skipPrevious();
        }
      }
    }

    draggingRef.current = false;
    activePointerIdRef.current = null;
    resetBeltSkipGestureState(skipStateRef.current);
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
