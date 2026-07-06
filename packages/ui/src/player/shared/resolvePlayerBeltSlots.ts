import type { PlayerQueueItem } from '@ui/player/core/types';

export type PlayerBeltSlots = {
  slots: PlayerQueueItem[];
  activeIndex: number;
};

/** Prev / current / next rows for a horizontal player belt (mini bar text or cover art). */
export function resolvePlayerBeltSlots(
  queue: readonly PlayerQueueItem[],
  currentIndex: number | null,
  currentItem: PlayerQueueItem | null,
  hasNext: boolean,
  hasPrevious: boolean,
): PlayerBeltSlots {
  if (!currentItem) {
    return { slots: [], activeIndex: 0 };
  }
  if (currentIndex === null || queue.length === 0) {
    return { slots: [currentItem], activeIndex: 0 };
  }

  let prev: PlayerQueueItem | null = null;
  let next: PlayerQueueItem | null = null;

  if (currentIndex > 0) {
    prev = queue[currentIndex - 1] ?? null;
  } else if (hasPrevious && queue.length > 1) {
    prev = queue[queue.length - 1] ?? null;
  }

  if (currentIndex + 1 < queue.length) {
    next = queue[currentIndex + 1] ?? null;
  } else if (hasNext && queue.length > 1) {
    next = queue[0] ?? null;
  }

  if (prev?.rowId === currentItem.rowId) prev = null;
  if (next?.rowId === currentItem.rowId) next = null;

  const slots: PlayerQueueItem[] = [];
  if (prev) slots.push(prev);
  slots.push(currentItem);
  if (next) slots.push(next);

  return { slots, activeIndex: prev ? 1 : 0 };
}

/** Clamp horizontal belt drag so prev/next stay off-screen until pulled in. */
export function clampPlayerBeltDragPx(
  dragPx: number,
  slotCount: number,
  activeIndex: number,
  slotWidthPx: number,
): number {
  if (slotCount <= 1 || slotWidthPx <= 0) return 0;
  const maxDrag = activeIndex * slotWidthPx;
  const minDrag = -((slotCount - 1 - activeIndex) * slotWidthPx);
  return Math.min(maxDrag, Math.max(minDrag, dragPx));
}
