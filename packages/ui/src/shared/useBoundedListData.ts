import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ListRange, VirtuosoGridHandle, VirtuosoHandle } from "react-virtuoso";
import {
  BOUNDED_LIST_WINDOW,
  boundedWindowStart,
  nextBoundedWindowStart,
} from "./boundedListWindow";
import { libraryScrollMemory } from "./libraryScrollMemory";

function indexMemoryKey(memoryKey: string): string {
  return `${memoryKey}#idx`;
}

function readSavedIndex(memoryKey: string | undefined): number {
  if (!memoryKey) return 0;
  return libraryScrollMemory.get(indexMemoryKey(memoryKey)) ?? 0;
}

/**
 * Render a sliding window of a list instead of the full array.
 * `memoryKey` restores the first visible row across remounts (history back).
 * `resetKey` (search text, display mode) jumps back to the top.
 */
export function useBoundedListData<T>(
  items: readonly T[],
  options?: { memoryKey?: string; resetKey?: string | number },
): {
  data: readonly T[];
  initialTopMostItemIndex: number;
  /** Absolute index of `data[0]` in `items`. */
  start: number;
  rangeChanged: (range: ListRange) => void;
  virtuosoRef: (handle: VirtuosoHandle | VirtuosoGridHandle | null) => void;
  virtuosoKey: string;
} {
  const memoryKey = options?.memoryKey;
  const resetKey = options?.resetKey ?? "";
  const length = items.length;

  const [startState, setStart] = useState(() =>
    boundedWindowStart(readSavedIndex(memoryKey), length),
  );
  const resetSeen = useRef(resetKey);
  const generation = useRef(0);
  const anchorRef = useRef<{ index: number; align: "start" | "end" } | null>(null);
  let start = startState;
  if (resetSeen.current !== resetKey) {
    resetSeen.current = resetKey;
    generation.current += 1;
    start = 0;
    anchorRef.current = null;
    if (startState !== 0) setStart(0);
    if (memoryKey) libraryScrollMemory.set(indexMemoryKey(memoryKey), 0);
  }

  const maxStart = length <= BOUNDED_LIST_WINDOW ? 0 : length - BOUNDED_LIST_WINDOW;
  if (start > maxStart) {
    start = maxStart;
    setStart(maxStart);
  }

  const initialTopRef = useRef<number | null>(null);
  if (initialTopRef.current === null && length > 0 && generation.current === 0) {
    const saved = Math.min(readSavedIndex(memoryKey), length - 1);
    const initialStart = boundedWindowStart(saved, length);
    initialTopRef.current = Math.max(0, saved - initialStart);
    start = initialStart;
    if (initialStart !== startState) setStart(initialStart);
  }

  const startRef = useRef(start);
  startRef.current = start;
  const lengthRef = useRef(length);
  lengthRef.current = length;
  const memoryKeyRef = useRef(memoryKey);
  memoryKeyRef.current = memoryKey;
  const virtuosoRef = useRef<{
    scrollToIndex: (location: {
      index: number;
      align?: "start" | "center" | "end";
      behavior?: "auto" | "smooth";
    }) => void;
  } | null>(null);
  const bindVirtuosoRef = useCallback((handle: VirtuosoHandle | VirtuosoGridHandle | null) => {
    virtuosoRef.current = handle;
  }, []);
  const skipInitialPin = useRef(true);

  const data = useMemo(
    () => items.slice(start, start + BOUNDED_LIST_WINDOW),
    [items, start],
  );

  useLayoutEffect(() => {
    if (skipInitialPin.current) {
      skipInitialPin.current = false;
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchorRef.current = null;
    const local = anchor.index - startRef.current;
    virtuosoRef.current?.scrollToIndex({
      index: Math.max(0, Math.min(local, data.length - 1)),
      align: anchor.align,
      behavior: "auto",
    });
  }, [start, data.length]);

  const rangeChanged = useCallback((range: ListRange) => {
    const key = memoryKeyRef.current;
    if (key) {
      libraryScrollMemory.set(indexMemoryKey(key), startRef.current + range.startIndex);
    }
    const next = nextBoundedWindowStart({
      start: startRef.current,
      length: lengthRef.current,
      rangeStart: range.startIndex,
      rangeEnd: range.endIndex,
    });
    if (!next) return;
    anchorRef.current = { index: next.anchorIndex, align: next.align };
    setStart(next.start);
  }, []);

  const initialTopMostItemIndex =
    generation.current === 0 ? (initialTopRef.current ?? 0) : 0;

  return {
    data,
    start,
    initialTopMostItemIndex,
    rangeChanged,
    virtuosoRef: bindVirtuosoRef,
    virtuosoKey: String(generation.current),
  };
}
