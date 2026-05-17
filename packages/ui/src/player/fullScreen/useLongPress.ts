import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 380;
const MOVE_THRESHOLD_PX = 10;

export function useLongPress(options: {
  disabled?: boolean;
  onLongPress: () => void;
  delayMs?: number;
}): {
  longPressPointerProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Returns true once after a long press so the next click can be ignored. */
  consumeLongPress: () => boolean;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const firedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { disabled, onLongPress, delayMs = DEFAULT_DELAY_MS } =
        optionsRef.current;
      if (disabled || e.button !== 0) return;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* already captured */
      }

      clearTimer();
      firedRef.current = false;
      activePointerIdRef.current = e.pointerId;
      originXRef.current = e.clientX;
      originYRef.current = e.clientY;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (activePointerIdRef.current !== e.pointerId) return;
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [clearTimer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      const dx = e.clientX - originXRef.current;
      const dy = e.clientY - originYRef.current;
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const resetPointer = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      clearTimer();
      activePointerIdRef.current = null;
    },
    [clearTimer],
  );

  const consumeLongPress = useCallback(() => {
    if (!firedRef.current) return false;
    firedRef.current = false;
    return true;
  }, []);

  return {
    longPressPointerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: resetPointer,
      onPointerCancel: resetPointer,
    },
    consumeLongPress,
  };
}
