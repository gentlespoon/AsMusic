import { useCallback, useEffect, useRef } from "react";
import type { ListRange, VirtuosoHandle } from "react-virtuoso";
import type { PlayerViewState } from "@ui/player/core/types";

function resolveCurrentScrollIndex(state: PlayerViewState): number | null {
  if (state.currentIndex === null || state.queue.length === 0) return null;
  return Math.min(Math.max(state.currentIndex, 0), state.queue.length - 1);
}

export function usePlayingQueueScroll(state: PlayerViewState) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const pendingScrollIndexRef = useRef<number | null>(null);
  /** Stop follow-scroll after layout settles so manual queue browsing is not overridden. */
  const scrollFollowUntilRef = useRef(0);

  const currentScrollIndex = resolveCurrentScrollIndex(state);

  const scrollToIndex = useCallback((index: number) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align: "center",
      behavior: "auto",
    });
  }, []);

  const scheduleScrollToCurrent = useCallback(() => {
    const idx = currentScrollIndex;
    if (idx === null) {
      pendingScrollIndexRef.current = null;
      return;
    }
    pendingScrollIndexRef.current = idx;
    scrollFollowUntilRef.current = Date.now() + 400;

    const attempt = () => scrollToIndex(idx);
    attempt();
    const raf = requestAnimationFrame(attempt);
    const t1 = window.setTimeout(attempt, 50);
    const t2 = window.setTimeout(attempt, 280);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [currentScrollIndex, scrollToIndex]);

  useEffect(() => scheduleScrollToCurrent(), [scheduleScrollToCurrent]);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (Date.now() > scrollFollowUntilRef.current) {
        pendingScrollIndexRef.current = null;
        return;
      }
      const target = pendingScrollIndexRef.current;
      if (target === null) return;
      if (range.startIndex <= target && target <= range.endIndex) {
        pendingScrollIndexRef.current = null;
        return;
      }
      scrollToIndex(target);
    },
    [scrollToIndex],
  );

  return { virtuosoRef, currentScrollIndex, handleRangeChanged };
}
