import { useEffect, useRef, useState } from "react";

/** Fraction delta large enough to treat as a seek (not transport drift). */
const SEEK_THRESHOLD = 0.03;

type Options = {
  isPlaying: boolean;
  smooth: boolean;
  durationSeconds?: number;
};

/**
 * Advances progress smoothly between coarse transport ticks without snapping backward
 * when extrapolation runs slightly ahead of the next host position report.
 */
export function useSmoothPlayedFraction(
  targetFraction: number,
  { isPlaying, smooth, durationSeconds }: Options,
): number {
  const target = Math.min(1, Math.max(0, targetFraction));
  const [display, setDisplay] = useState(target);
  const anchorRef = useRef({ fraction: target, time: performance.now() });
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    prevTargetRef.current = target;
    anchorRef.current = { fraction: target, time: performance.now() };

    if (!smooth || !isPlaying) {
      setDisplay(target);
      return;
    }

    setDisplay((prev) => {
      if (Math.abs(target - prevTarget) > SEEK_THRESHOLD) return target;
      if (target < prev - 0.005) return target;
      return prev;
    });
  }, [target, smooth, isPlaying]);

  useEffect(() => {
    if (!smooth || !isPlaying) return;

    let raf = 0;
    const tick = () => {
      const { fraction, time } = anchorRef.current;
      const elapsed = (performance.now() - time) / 1000;
      let ideal = fraction;
      if (durationSeconds != null && durationSeconds > 0) {
        ideal = Math.min(1, fraction + elapsed / durationSeconds);
      }

      setDisplay((prev) => {
        if (ideal < prev - SEEK_THRESHOLD) return ideal;
        if (ideal > prev + SEEK_THRESHOLD) return ideal;
        return Math.min(1, Math.max(prev, ideal));
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [smooth, isPlaying, durationSeconds]);

  return !smooth || !isPlaying ? target : display;
}
