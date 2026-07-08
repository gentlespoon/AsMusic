import type { Child } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import type { ServerPlaylistScope } from './cacheScope';
import type { LibraryCacheStorage, LibraryPlaylistSummary } from './storage/LibraryCacheStorage';
import { playlistEntriesFromGetPlaylistResponse } from './playlistEntries';

function isOk(r: { status?: string } | null | undefined): boolean {
  return r?.status === 'ok';
}

/** Fetch playlist summaries from Subsonic `getPlaylists`. */
export async function fetchPlaylistSummariesFromApi(api: SubsonicAPI): Promise<LibraryPlaylistSummary[]> {
  try {
    const pl = await api.getPlaylists();
    if (!isOk(pl) || !pl.playlists?.playlist?.length) return [];
    const raw = pl.playlists.playlist;
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((p) => ({
      id: String(p.id),
      name: p.name,
      songCount: p.songCount ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Re-fetch playlist summaries and persist to {@link LibraryCacheStorage} (no full song sync). */
export async function refreshPlaylistSummariesOnly(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: ServerPlaylistScope
): Promise<LibraryPlaylistSummary[]> {
  const list = await fetchPlaylistSummariesFromApi(api);
  await storage.replacePlaylistSummaries(scope, list);
  return list;
}

/** Fetch ordered track ids for one server playlist. */
export async function fetchPlaylistEntryTrackIdsFromApi(
  api: SubsonicAPI,
  playlistId: string,
): Promise<string[]> {
  const res = await api.getPlaylist({ id: playlistId });
  if (!isOk(res) || !res.playlist) return [];
  return playlistEntriesFromGetPlaylistResponse(res.playlist).map((e) => String(e.id));
}

/** Cache entry track ids for every playlist summary on a server (best-effort). */
export async function refreshPlaylistEntryTrackIdsForServer(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: ServerPlaylistScope,
  summaries: LibraryPlaylistSummary[],
): Promise<void> {
  const playlistIds: string[] = [];
  for (const summary of summaries) {
    try {
      const trackIds = await fetchPlaylistEntryTrackIdsFromApi(api, summary.id);
      await storage.replacePlaylistEntryTrackIds(scope, summary.id, trackIds);
      playlistIds.push(summary.id);
    } catch {
      // Keep any previously cached entry order for this playlist.
      playlistIds.push(summary.id);
    }
  }
  await storage.purgePlaylistEntryTrackIdsNotIn(scope, playlistIds);
}

/** Re-fetch summaries and entry track ids for a server account. */
export async function refreshPlaylistCacheForServer(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: ServerPlaylistScope,
): Promise<LibraryPlaylistSummary[]> {
  const list = await refreshPlaylistSummariesOnly(api, storage, scope);
  await refreshPlaylistEntryTrackIdsForServer(api, storage, scope, list);
  return list;
}

/** @deprecated Use {@link refreshPlaylistCacheForServer}. */
export async function refreshPlaylistCacheForScope(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: ServerPlaylistScope,
): Promise<LibraryPlaylistSummary[]> {
  return refreshPlaylistCacheForServer(api, storage, scope);
}

/** Refresh cached entry track ids for one playlist after a membership mutation. */
export async function refreshPlaylistEntryTrackIdsOnly(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: ServerPlaylistScope,
  playlistId: string,
): Promise<void> {
  const trackIds = await fetchPlaylistEntryTrackIdsFromApi(api, playlistId);
  await storage.replacePlaylistEntryTrackIds(scope, playlistId, trackIds);
}

/**
 * Subsonic `updatePlaylist`: remove indices high → low, then add each song id (legacy iOS parity).
 */
export async function updatePlaylistTracks(
  api: SubsonicAPI,
  args: {
    playlistId: string;
    songIdsToAdd: string[];
    songIndexesToRemove: number[];
  }
): Promise<void> {
  const { playlistId, songIdsToAdd, songIndexesToRemove } = args;
  if (songIndexesToRemove.length > 0) {
    const res = await api.updatePlaylist({
      playlistId,
      songIndexToRemove: [...songIndexesToRemove].sort((a, b) => b - a),
    });
    if (!isOk(res)) {
      throw new Error('Could not update playlist');
    }
  }
  if (songIdsToAdd.length > 0) {
    const res = await api.updatePlaylist({
      playlistId,
      songIdToAdd: songIdsToAdd,
    });
    if (!isOk(res)) {
      throw new Error('Could not update playlist');
    }
  }
}

/** Compute add/remove sets for checkbox editor save (legacy {@link PlaylistEditorView}). */
export function playlistEditDiff(args: {
  originalEntryIds: string[];
  selectedSongIds: Set<string>;
}): { songIdsToAdd: string[]; songIndexesToRemove: number[] } {
  const { originalEntryIds, selectedSongIds } = args;
  const originalSet = new Set(originalEntryIds);
  const songIdsToAdd = [...selectedSongIds].filter((id) => !originalSet.has(id));
  const toRemove = new Set([...originalSet].filter((id) => !selectedSongIds.has(id)));
  const songIndexesToRemove = originalEntryIds
    .map((id, index) => (toRemove.has(id) ? index : -1))
    .filter((i) => i >= 0);
  return { songIdsToAdd, songIndexesToRemove };
}

/** Reorder playlist by replacing all entries (legacy drag-reorder save). */
export async function reorderPlaylistEntries(
  api: SubsonicAPI,
  playlistId: string,
  previousEntryCount: number,
  orderedSongIds: string[]
): Promise<void> {
  const removeIndexes = Array.from({ length: previousEntryCount }, (_, i) => i);
  await updatePlaylistTracks(api, {
    playlistId,
    songIdsToAdd: orderedSongIds,
    songIndexesToRemove: removeIndexes,
  });
}

export function filterPlaylistEntries(entries: Child[]): Child[] {
  return entries.filter((e) => !e.isDir);
}
