/**
 * How many rows exist in the DOM list at once.
 * Virtuoso sizes its scrollport from the full item count. A million rows is tens of
 * millions of pixels, and iOS hangs while that layer is created or destroyed.
 */
export const BOUNDED_LIST_WINDOW = 400;

const EDGE = 24;
const PLACE = 80;

/** Place `anchorIndex` near the middle. Used by the playing queue. */
export function centeredWindowStart(
  anchorIndex: number,
  length: number,
  windowSize = BOUNDED_LIST_WINDOW,
): number {
  if (length <= windowSize) return 0;
  const maxStart = length - windowSize;
  const centered = anchorIndex - Math.floor(windowSize / 2);
  return Math.max(0, Math.min(centered, maxStart));
}

/** Place `anchorIndex` a short distance below the top so the user can scroll back a little. */
export function boundedWindowStart(
  anchorIndex: number,
  length: number,
  windowSize = BOUNDED_LIST_WINDOW,
): number {
  if (length <= windowSize) return 0;
  const maxStart = length - windowSize;
  const start = Math.max(0, anchorIndex - PLACE);
  return Math.min(start, maxStart);
}

/**
 * Slide the window when the viewport reaches either edge.
 * Returns the absolute index that should stay pinned, or null when the window can stay put.
 */
export function nextBoundedWindowStart(options: {
  start: number;
  length: number;
  rangeStart: number;
  rangeEnd: number;
  windowSize?: number;
}): { start: number; anchorIndex: number; align: "start" | "end" } | null {
  const windowSize = options.windowSize ?? BOUNDED_LIST_WINDOW;
  const { start, length, rangeStart, rangeEnd } = options;
  if (length <= windowSize) return null;
  const size = windowSize;
  const atTop = rangeStart < EDGE && start > 0;
  const atBottom = rangeEnd > size - 1 - EDGE && start + size < length;
  if (!atTop && !atBottom) return null;

  const anchorIndex = start + (atTop ? rangeStart : rangeEnd);
  const unclamped = atTop
    ? anchorIndex - PLACE
    : anchorIndex - (size - 1 - PLACE);
  const next = Math.max(0, Math.min(unclamped, length - size));
  if (next === start) return null;
  return { start: next, anchorIndex, align: atTop ? "start" : "end" };
}
