import { useCallback, useRef } from 'react';

/** Width of the left screen edge that starts a back swipe (iOS-style). */
const EDGE_WIDTH_PX = 24;
/** Minimum rightward travel to trigger `onBack`. */
const COMMIT_THRESHOLD_PX = 64;
const DIRECTION_SLOP_PX = 10;
/** Horizontal movement must dominate vertical by this factor. */
const HORIZONTAL_DOMINANCE = 1.25;

type PendingGesture = {
  pointerId: number;
  startX: number;
  startY: number;
};

/**
 * Swipe right from the left screen edge to navigate back (same as the page close button).
 * Vertical drags from the edge are left to child scrollers.
 */
export function useEdgeSwipeBack(onBack: () => void): {
  onPointerDownCapture: (e: React.PointerEvent) => void;
  onPointerMoveCapture: (e: React.PointerEvent) => void;
  onPointerUpCapture: (e: React.PointerEvent) => void;
  onPointerCancelCapture: (e: React.PointerEvent) => void;
} {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const pendingRef = useRef<PendingGesture | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const clearPending = () => {
    pendingRef.current = null;
  };

  const resetActive = () => {
    activePointerIdRef.current = null;
    clearPending();
  };

  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || e.clientX > EDGE_WIDTH_PX) return;
    pendingRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    activePointerIdRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
  }, []);

  const onPointerMoveCapture = useCallback((e: React.PointerEvent) => {
    const pending = pendingRef.current;
    if (pending && e.pointerId === pending.pointerId && activePointerIdRef.current == null) {
      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      if (Math.abs(dx) < DIRECTION_SLOP_PX && Math.abs(dy) < DIRECTION_SLOP_PX) return;

      if (dx <= 0 || Math.abs(dy) * HORIZONTAL_DOMINANCE >= Math.abs(dx)) {
        clearPending();
        return;
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* already captured */
      }
      activePointerIdRef.current = e.pointerId;
      startXRef.current = pending.startX;
      startYRef.current = pending.startY;
      clearPending();
      return;
    }

    if (e.pointerId !== activePointerIdRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (dx <= 0 || Math.abs(dy) * HORIZONTAL_DOMINANCE >= Math.abs(dx)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      resetActive();
    }
  }, []);

  const onPointerUpCapture = useCallback((e: React.PointerEvent) => {
    if (pendingRef.current?.pointerId === e.pointerId) {
      clearPending();
      return;
    }
    if (e.pointerId !== activePointerIdRef.current) return;

    const dx = e.clientX - startXRef.current;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    resetActive();

    if (dx >= COMMIT_THRESHOLD_PX) {
      onBackRef.current();
    }
  }, []);

  const onPointerCancelCapture = useCallback((e: React.PointerEvent) => {
    if (pendingRef.current?.pointerId === e.pointerId) {
      clearPending();
      return;
    }
    if (e.pointerId !== activePointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    resetActive();
  }, []);

  return {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
  };
}
