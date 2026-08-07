import { albumCreatedMs, songPlayCount } from '@asmusic/core';
import type { SongListEntry } from './SongListView';

export const RECOMMENDATIONS_FULL_LIMIT = 50;
export const RECOMMENDATIONS_PREVIEW_LIMIT = 5;

export function selectNewestSongEntries(
  songEntries: SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT
): SongListEntry[] {
  return [...songEntries]
    .sort((a, b) => albumCreatedMs(b.song) - albumCreatedMs(a.song))
    .slice(0, limit);
}

export function selectMostPlayedSongEntries(
  songEntries: SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT
): SongListEntry[] {
  return [...songEntries]
    .sort((a, b) => {
      const byPlay = songPlayCount(b.song) - songPlayCount(a.song);
      if (byPlay !== 0) return byPlay;
      return albumCreatedMs(b.song) - albumCreatedMs(a.song);
    })
    .slice(0, limit);
}
