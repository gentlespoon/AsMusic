import type { Child } from 'subsonic-api';
import { serverAccountKey, type LibraryCacheScope } from '../library/cacheScope';
import type { LibraryCacheStorage } from '../library/storage/LibraryCacheStorage';
import type { LocalPlaylistEntry, LocalPlaylistTrackRef } from './LocalPlaylistStore';

export type LocalPlaylistResolvedEntry =
  | {
      status: 'available';
      ref: LocalPlaylistTrackRef;
      sortIndex: number;
      song: Child;
      serverId: string;
      libraryId: string;
      scope: LibraryCacheScope;
    }
  | {
      status: 'unavailable';
      ref: LocalPlaylistTrackRef;
      sortIndex: number;
      displayTitle: string;
      displayArtist?: string;
      displayAlbum?: string;
    };

export type ServerConfigForLocalPlaylist = {
  id: string;
  serverUrl: string;
  username: string;
};

function findSongInList(songs: Child[], trackId: string): Child | undefined {
  return songs.find((s) => String(s.id) === trackId);
}

function serverIdForKey(servers: readonly ServerConfigForLocalPlaylist[], serverKey: string): string | null {
  for (const s of servers) {
    if (serverAccountKey(s.serverUrl, s.username) === serverKey) return s.id;
  }
  return null;
}

export function resolveLocalPlaylistEntrySync(args: {
  entry: LocalPlaylistEntry;
  songsByScope: ReadonlyMap<string, Child[]>;
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): LocalPlaylistResolvedEntry {
  const { entry, songsByScope, servers, unavailableLabel } = args;
  const scopeKey = `${entry.serverKey}|${entry.libraryId}`;
  const songs = songsByScope.get(scopeKey);
  const song = songs ? findSongInList(songs, entry.trackId) : undefined;
  const serverId = serverIdForKey(servers, entry.serverKey);

  if (song && serverId) {
    return {
      status: 'available',
      ref: entry,
      sortIndex: entry.sortIndex,
      song,
      serverId,
      libraryId: entry.libraryId,
      scope: { serverKey: entry.serverKey, libraryId: entry.libraryId },
    };
  }

  return {
    status: 'unavailable',
    ref: entry,
    sortIndex: entry.sortIndex,
    displayTitle: entry.title?.trim() || unavailableLabel,
    displayArtist: entry.artist,
    displayAlbum: entry.album,
  };
}

/** Load song lists from disk for scopes missing from the in-memory map. */
export async function buildSongsByScopeMap(args: {
  entries: readonly LocalPlaylistEntry[];
  songsByScope: ReadonlyMap<string, Child[]>;
  libraryCache: LibraryCacheStorage;
}): Promise<Map<string, Child[]>> {
  const out = new Map(args.songsByScope);
  const needed = new Set<string>();
  for (const e of args.entries) {
    const key = `${e.serverKey}|${e.libraryId}`;
    if (!out.has(key)) needed.add(key);
  }
  await Promise.all(
    [...needed].map(async (key) => {
      const [serverKey, libraryId] = key.split('|');
      if (!serverKey || !libraryId) return;
      try {
        const songs = await args.libraryCache.readSongList({ serverKey, libraryId });
        out.set(key, songs);
      } catch {
        out.set(key, []);
      }
    })
  );
  return out;
}

export async function resolveLocalPlaylistEntries(args: {
  entries: readonly LocalPlaylistEntry[];
  songsByScope: ReadonlyMap<string, Child[]>;
  libraryCache: LibraryCacheStorage;
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): Promise<LocalPlaylistResolvedEntry[]> {
  const songsMap = await buildSongsByScopeMap({
    entries: args.entries,
    songsByScope: args.songsByScope,
    libraryCache: args.libraryCache,
  });
  return args.entries.map((entry) =>
    resolveLocalPlaylistEntrySync({
      entry,
      songsByScope: songsMap,
      servers: args.servers,
      unavailableLabel: args.unavailableLabel,
    })
  );
}

export type PlayerQueueItemLike = {
  rowId: string;
  serverId: string;
  libraryId: string;
  trackId: string;
  serverUrl: string;
  username: string;
  title: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  suffix?: string;
  bitRate?: number;
  coverArtId?: string;
  starred?: boolean;
};

export function newQueueRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Build a queue item for every local entry; never filters unavailable tracks. */
export function playerQueueItemFromLocalEntry(args: {
  ref: LocalPlaylistTrackRef;
  song?: Child;
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): PlayerQueueItemLike | null {
  const { ref, song, servers, unavailableLabel } = args;
  const server = servers.find((s) => serverAccountKey(s.serverUrl, s.username) === ref.serverKey);
  if (!server) {
    return {
      rowId: newQueueRowId(),
      serverId: '',
      libraryId: ref.libraryId,
      trackId: ref.trackId,
      serverUrl: '',
      username: '',
      title: ref.title?.trim() || unavailableLabel,
      artist: ref.artist,
      album: ref.album,
      coverArtId: ref.coverArtId,
    };
  }
  const serverUrl = server.serverUrl.replace(/\/$/, '');
  if (song) {
    return {
      rowId: newQueueRowId(),
      serverId: server.id,
      libraryId: ref.libraryId,
      trackId: ref.trackId,
      serverUrl,
      username: server.username,
      title: song.title ?? ref.title ?? unavailableLabel,
      artist: song.artist ?? ref.artist,
      album: song.album ?? ref.album,
      durationSeconds: song.duration ?? undefined,
      suffix: song.suffix ?? undefined,
      bitRate: song.bitRate ?? undefined,
      coverArtId: song.coverArt?.trim() || ref.coverArtId,
      starred: song.starred != null,
    };
  }
  return {
    rowId: newQueueRowId(),
    serverId: server.id,
    libraryId: ref.libraryId,
    trackId: ref.trackId,
    serverUrl,
    username: server.username,
    title: ref.title?.trim() || unavailableLabel,
    artist: ref.artist,
    album: ref.album,
    coverArtId: ref.coverArtId,
  };
}
