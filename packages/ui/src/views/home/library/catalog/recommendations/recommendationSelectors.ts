import { albumCreatedMs, songPlayCount, songPlayedMs } from "@asmusic/core";
import type { SongListEntry } from "../SongListView";

export const RECOMMENDATIONS_FULL_LIMIT = 100;
export const RECOMMENDATIONS_PREVIEW_LIMIT = 3;

export function selectNewestSongEntries(
  songEntries: SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return [...songEntries]
    .sort((a, b) => albumCreatedMs(b.song) - albumCreatedMs(a.song))
    .slice(0, limit);
}

export function selectMostPlayedSongEntries(
  songEntries: SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return [...songEntries]
    .sort((a, b) => {
      const byPlay = songPlayCount(b.song) - songPlayCount(a.song);
      if (byPlay !== 0) return byPlay;
      return albumCreatedMs(b.song) - albumCreatedMs(a.song);
    })
    .slice(0, limit);
}

export function selectRecentlyPlayedSongEntries(
  songEntries: SongListEntry[],
  limit = RECOMMENDATIONS_FULL_LIMIT,
): SongListEntry[] {
  return [...songEntries]
    .filter((e) => songPlayedMs(e.song) > 0)
    .sort((a, b) => {
      const byPlayed = songPlayedMs(b.song) - songPlayedMs(a.song);
      if (byPlayed !== 0) return byPlayed;
      return albumCreatedMs(b.song) - albumCreatedMs(a.song);
    })
    .slice(0, limit);
}
