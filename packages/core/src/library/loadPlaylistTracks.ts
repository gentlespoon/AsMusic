import type { Child } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import { mergePlaylistEntryWithCachedSongs, playlistEntriesFromGetPlaylistResponse } from './playlistEntries';
import type { LibraryCacheStorage } from './storage/LibraryCacheStorage';

export type LoadPlaylistTracksResult = {
  title: string;
  tracks: Child[];
  /** Full playlist order from server or entry cache (not filtered to cached songs). */
  entryTrackIds: string[];
  fromCache: boolean;
};

function tracksFromCachedEntryIds(trackIds: string[], cachedSongs: Child[]): Child[] {
  const byId = new Map(cachedSongs.map((s) => [String(s.id), s]));
  return trackIds.map((id) => byId.get(id)).filter((s): s is Child => s != null);
}

/**
 * Load playlist tracks from the server (always attempted), persisting entry order to cache.
 * Falls back to cached entry ids joined against the server song cache if the request fails.
 */
export async function loadPlaylistTracks(args: {
  api: SubsonicAPI;
  storage: LibraryCacheStorage;
  serverKey: string;
  playlistId: string;
  playlistTitle: string;
  cachedSongs: Child[];
}): Promise<LoadPlaylistTracksResult> {
  const { api, storage, serverKey, playlistId, playlistTitle, cachedSongs } = args;
  const scope = { serverKey };

  try {
    const res = await api.getPlaylist({ id: playlistId });
    if (res.status === 'ok' && res.playlist) {
      const pl = res.playlist;
      const name = typeof pl.name === 'string' && pl.name.length > 0 ? pl.name : playlistTitle;
      const entries = playlistEntriesFromGetPlaylistResponse(pl);
      const trackIds = entries.map((e) => String(e.id));
      await storage.replacePlaylistEntryTrackIds(scope, playlistId, trackIds);
      const tracks = entries.map((e) => mergePlaylistEntryWithCachedSongs(e, cachedSongs));
      return { title: name, tracks, entryTrackIds: trackIds, fromCache: false };
    }
  } catch {
    // Fall through to cached entry ids.
  }

  const trackIds = await storage.readPlaylistEntryTrackIds(scope, playlistId);
  if (trackIds.length === 0) {
    throw new Error('Could not load playlist from server');
  }

  return {
    title: playlistTitle,
    tracks: tracksFromCachedEntryIds(trackIds, cachedSongs),
    entryTrackIds: trackIds,
    fromCache: true,
  };
}
