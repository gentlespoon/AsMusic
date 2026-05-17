import type { Child } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import type { LibraryCacheScope } from './cacheScope';
import type { LibraryCacheStorage, LibraryPlaylistSummary } from './storage/LibraryCacheStorage';

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
  scope: LibraryCacheScope
): Promise<LibraryPlaylistSummary[]> {
  const list = await fetchPlaylistSummariesFromApi(api);
  await storage.replacePlaylistSummaries(scope, list);
  return list;
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
