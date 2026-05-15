import type { Child } from 'subsonic-api';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Normalize Subsonic `getPlaylist` `entry` (single object or array). */
export function playlistEntriesFromGetPlaylistResponse(playlist: unknown): Child[] {
  if (!isRecord(playlist)) return [];
  const entry = playlist.entry;
  if (entry == null) return [];
  if (Array.isArray(entry)) return entry as Child[];
  return [entry as Child];
}

/** Prefer cached library row when present (artwork, starred, etc.). */
export function mergePlaylistEntryWithCachedSongs(entry: Child, cachedSongs: Child[]): Child {
  const hit = cachedSongs.find((s) => String(s.id) === String(entry.id));
  if (!hit) return entry;
  return { ...hit, ...entry };
}
