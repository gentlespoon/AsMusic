import { albumCreatedMs, songPlayCount, songPlayedMs } from "@asmusic/core";
import type { SongListEntry } from "../SongListView";

export const RECOMMENDATIONS_FULL_LIMIT = 100;
export const RECOMMENDATIONS_PREVIEW_LIMIT = 3;

/**
 * Keep the `limit` items that `compare` would place first, without sorting the full catalog.
 * `compare` matches `Array#sort`: a negative result means `a` ranks first.
 */
export function takeTop<T>(
  items: readonly T[],
  limit: number,
  compare: (a: T, b: T) => number,
  include?: (item: T) => boolean,
): T[] {
  if (limit <= 0 || items.length === 0) return [];
  const heap: T[] = [];

  const swap = (i: number, j: number) => {
    const tmp = heap[i]!;
    heap[i] = heap[j]!;
    heap[j] = tmp;
  };
  const siftUp = (index: number) => {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compare(heap[parent]!, heap[i]!) >= 0) break;
      swap(parent, i);
      i = parent;
    }
  };
  const siftDown = (index: number) => {
    let i = index;
    const n = heap.length;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let worst = i;
      if (left < n && compare(heap[left]!, heap[worst]!) > 0) worst = left;
      if (right < n && compare(heap[right]!, heap[worst]!) > 0) worst = right;
      if (worst === i) break;
      swap(i, worst);
      i = worst;
    }
  };

  for (const item of items) {
    if (include && !include(item)) continue;
    if (heap.length < limit) {
      heap.push(item);
      siftUp(heap.length - 1);
      continue;
    }
    if (compare(item, heap[0]!) < 0) {
      heap[0] = item;
      siftDown(0);
    }
  }
  heap.sort(compare);
  return heap;
}

function byNewest(a: SongListEntry, b: SongListEntry): number {
  return albumCreatedMs(b.song) - albumCreatedMs(a.song);
}

function byMostPlayed(a: SongListEntry, b: SongListEntry): number {
  const byPlay = songPlayCount(b.song) - songPlayCount(a.song);
  if (byPlay !== 0) return byPlay;
  return albumCreatedMs(b.song) - albumCreatedMs(a.song);
}

function byRecentlyPlayed(a: SongListEntry, b: SongListEntry): number {
  const byPlayed = songPlayedMs(b.song) - songPlayedMs(a.song);
  if (byPlayed !== 0) return byPlayed;
  return albumCreatedMs(b.song) - albumCreatedMs(a.song);
}

export function selectNewestSongEntries(
  songEntries: readonly SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return takeTop(songEntries, limit, byNewest);
}

export function selectMostPlayedSongEntries(
  songEntries: readonly SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return takeTop(songEntries, limit, byMostPlayed);
}

export function selectRecentlyPlayedSongEntries(
  songEntries: readonly SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return takeTop(songEntries, limit, byRecentlyPlayed, (entry) => songPlayedMs(entry.song) > 0);
}
