import { useCallback, useMemo } from 'react';
import type { Child } from 'subsonic-api';
import { useT } from '@asmusic/i18n';
import { usePlayerActions, useServerAndLibrary } from '../../../../contexts';
import { playerQueueItemFromChild } from '../../../../player/core/playerQueueItemFromChild';
import {
  playerQueueItemsFromLocalResolvedEntries,
  localPlaylistEntriesToResolvedSync,
} from '../../../../player/core/playerQueueItemFromLocalEntry';
import type { PlayerQueueItem } from '../../../../player/core/types';
import type { SongListEntry } from '../catalog/SongListView';
import type {
  LibraryBrowserResolvedAlbum,
  LibraryBrowserResolvedArtist,
  LibraryBrowserResolvedPlaylist,
} from './useLibraryBrowserResolvedScopes';

function shuffleCopy<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Queue and playback actions for {@link LibraryBrowser} song, album, artist, and playlist views.
 */
export function useLibraryBrowserPlayback(options: {
  resolvedAlbum: LibraryBrowserResolvedAlbum | null;
  resolvedArtist: LibraryBrowserResolvedArtist | null;
  resolvedPlaylist: LibraryBrowserResolvedPlaylist | null;
  songsByScope: ReadonlyMap<string, Child[]>;
}) {
  const { resolvedAlbum, resolvedArtist, resolvedPlaylist, songsByScope } = options;
  const t = useT();
  const { servers } = useServerAndLibrary();
  const { insertAfterCurrent, appendToQueue, replaceQueueAndPlay } = usePlayerActions();

  const serverConfigs = useMemo(
    () => servers.map((s) => ({ id: s.id, serverUrl: s.serverUrl, username: s.username })),
    [servers]
  );

  const unavailableLabel = t('library.playlist.trackUnavailable');

  const serverMetaById = useMemo(
    () =>
      Object.fromEntries(
        servers.map((s) => [s.id, { serverUrl: s.serverUrl.replace(/\/$/, ''), username: s.username }])
      ) as Record<string, { serverUrl: string; username: string }>,
    [servers]
  );

  const queueItemFromCachedTrack = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      const meta = serverMetaById[serverId];
      if (!meta) return null;
      return playerQueueItemFromChild({
        song,
        serverId,
        libraryId,
        serverUrl: meta.serverUrl,
        username: meta.username,
      });
    },
    [serverMetaById]
  );

  const playSongEntryNow = useCallback(
    (entry: SongListEntry) => {
      const item = queueItemFromCachedTrack(entry.serverId, entry.artworkScope.libraryId, entry.song);
      if (item) void insertAfterCurrent([item], { playFirst: true });
    },
    [queueItemFromCachedTrack, insertAfterCurrent]
  );

  const playTrackNow = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      const item = queueItemFromCachedTrack(serverId, libraryId, song);
      if (item) void insertAfterCurrent([item], { playFirst: true });
    },
    [queueItemFromCachedTrack, insertAfterCurrent]
  );

  const playNextForSongEntry = useCallback(
    (entry: SongListEntry) => {
      const item = queueItemFromCachedTrack(entry.serverId, entry.artworkScope.libraryId, entry.song);
      if (item) void insertAfterCurrent([item], { playFirst: false });
    },
    [queueItemFromCachedTrack, insertAfterCurrent]
  );

  const appendForSongEntry = useCallback(
    (entry: SongListEntry) => {
      const item = queueItemFromCachedTrack(entry.serverId, entry.artworkScope.libraryId, entry.song);
      if (item) void appendToQueue([item]);
    },
    [queueItemFromCachedTrack, appendToQueue]
  );

  const playNextForTrack = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      const item = queueItemFromCachedTrack(serverId, libraryId, song);
      if (item) void insertAfterCurrent([item], { playFirst: false });
    },
    [queueItemFromCachedTrack, insertAfterCurrent]
  );

  const appendForTrack = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      const item = queueItemFromCachedTrack(serverId, libraryId, song);
      if (item) void appendToQueue([item]);
    },
    [queueItemFromCachedTrack, appendToQueue]
  );

  const appendAllSongEntriesToQueue = useCallback(
    (entries: SongListEntry[]) => {
      const items: PlayerQueueItem[] = [];
      for (const e of entries) {
        const it = queueItemFromCachedTrack(e.serverId, e.artworkScope.libraryId, e.song);
        if (it) items.push(it);
      }
      if (items.length > 0) void appendToQueue(items);
    },
    [queueItemFromCachedTrack, appendToQueue]
  );

  const shufflePlayAllSongEntries = useCallback(
    (entries: SongListEntry[]) => {
      const items: PlayerQueueItem[] = [];
      for (const e of entries) {
        const it = queueItemFromCachedTrack(e.serverId, e.artworkScope.libraryId, e.song);
        if (it) items.push(it);
      }
      if (items.length === 0) return;
      void replaceQueueAndPlay(shuffleCopy(items), 0);
    },
    [queueItemFromCachedTrack, replaceQueueAndPlay]
  );

  const appendAllAlbumTracksToQueue = useCallback(
    (tracks: Child[]) => {
      if (!resolvedAlbum) return;
      const { serverId, libraryId } = resolvedAlbum.slice;
      const items: PlayerQueueItem[] = [];
      for (const t of tracks) {
        const it = queueItemFromCachedTrack(serverId, libraryId, t);
        if (it) items.push(it);
      }
      if (items.length > 0) void appendToQueue(items);
    },
    [resolvedAlbum, queueItemFromCachedTrack, appendToQueue]
  );

  const shufflePlayAllAlbumTracks = useCallback(
    (tracks: Child[]) => {
      if (!resolvedAlbum) return;
      const { serverId, libraryId } = resolvedAlbum.slice;
      const items: PlayerQueueItem[] = [];
      for (const t of tracks) {
        const it = queueItemFromCachedTrack(serverId, libraryId, t);
        if (it) items.push(it);
      }
      if (items.length === 0) return;
      void replaceQueueAndPlay(shuffleCopy(items), 0);
    },
    [resolvedAlbum, queueItemFromCachedTrack, replaceQueueAndPlay]
  );

  const appendAllArtistTracksToQueue = useCallback(
    (tracks: Child[]) => {
      if (!resolvedArtist) return;
      const { serverId, libraryId } = resolvedArtist.slice;
      const items: PlayerQueueItem[] = [];
      for (const t of tracks) {
        const it = queueItemFromCachedTrack(serverId, libraryId, t);
        if (it) items.push(it);
      }
      if (items.length > 0) void appendToQueue(items);
    },
    [resolvedArtist, queueItemFromCachedTrack, appendToQueue]
  );

  const shufflePlayAllArtistTracks = useCallback(
    (tracks: Child[]) => {
      if (!resolvedArtist) return;
      const { serverId, libraryId } = resolvedArtist.slice;
      const items: PlayerQueueItem[] = [];
      for (const t of tracks) {
        const it = queueItemFromCachedTrack(serverId, libraryId, t);
        if (it) items.push(it);
      }
      if (items.length === 0) return;
      void replaceQueueAndPlay(shuffleCopy(items), 0);
    },
    [resolvedArtist, queueItemFromCachedTrack, replaceQueueAndPlay]
  );

  const queueItemsForPlaylistTracks = useCallback(
    (tracks: Child[]) => {
      if (!resolvedPlaylist) return [];
      if (resolvedPlaylist.kind === 'local') {
        const resolved = localPlaylistEntriesToResolvedSync({
          entries: resolvedPlaylist.entries,
          songsByScope,
          servers: serverConfigs,
          unavailableLabel,
        });
        return playerQueueItemsFromLocalResolvedEntries({
          resolved,
          servers: serverConfigs,
          unavailableLabel,
        });
      }
      const meta = serverMetaById[resolvedPlaylist.slice.serverId];
      if (!meta) return [];
      const items: PlayerQueueItem[] = [];
      for (const track of tracks) {
        const it = playerQueueItemFromChild({
          song: track,
          serverId: resolvedPlaylist.slice.serverId,
          libraryId: resolvedPlaylist.slice.libraryId,
          serverUrl: meta.serverUrl,
          username: meta.username,
        });
        items.push(it);
      }
      return items;
    },
    [resolvedPlaylist, serverMetaById, songsByScope, serverConfigs, unavailableLabel]
  );

  const appendAllPlaylistTracksToQueue = useCallback(
    (tracks: Child[]) => {
      const items = queueItemsForPlaylistTracks(tracks);
      if (items.length > 0) void appendToQueue(items);
    },
    [queueItemsForPlaylistTracks, appendToQueue]
  );

  const shufflePlayAllPlaylistTracks = useCallback(
    (tracks: Child[]) => {
      const items = queueItemsForPlaylistTracks(tracks);
      if (items.length === 0) return;
      void replaceQueueAndPlay(shuffleCopy(items), 0);
    },
    [queueItemsForPlaylistTracks, replaceQueueAndPlay]
  );

  const replaceQueueAndPlayAllPlaylistTracks = useCallback(
    (tracks: Child[]) => {
      const items = queueItemsForPlaylistTracks(tracks);
      if (items.length === 0) return;
      void replaceQueueAndPlay(items, 0);
    },
    [queueItemsForPlaylistTracks, replaceQueueAndPlay]
  );

  const replaceQueueAndPlayAllLocalPlaylist = useCallback(() => {
    if (!resolvedPlaylist || resolvedPlaylist.kind !== 'local') return;
    const items = queueItemsForPlaylistTracks([]);
    if (items.length > 0) void replaceQueueAndPlay(items, 0);
  }, [resolvedPlaylist, queueItemsForPlaylistTracks, replaceQueueAndPlay]);

  const appendAllLocalPlaylistToQueue = useCallback(() => {
    if (!resolvedPlaylist || resolvedPlaylist.kind !== 'local') return;
    const items = queueItemsForPlaylistTracks([]);
    if (items.length > 0) void appendToQueue(items);
  }, [resolvedPlaylist, queueItemsForPlaylistTracks, appendToQueue]);

  const shufflePlayAllLocalPlaylist = useCallback(() => {
    if (!resolvedPlaylist || resolvedPlaylist.kind !== 'local') return;
    const items = queueItemsForPlaylistTracks([]);
    if (items.length === 0) return;
    void replaceQueueAndPlay(shuffleCopy(items), 0);
  }, [resolvedPlaylist, queueItemsForPlaylistTracks, replaceQueueAndPlay]);

  const queueItemForLocalResolvedRow = useCallback(
    (row: import('@asmusic/core').LocalPlaylistResolvedEntry) => {
      const items = playerQueueItemsFromLocalResolvedEntries({
        resolved: [row],
        servers: serverConfigs,
        unavailableLabel,
      });
      return items[0] ?? null;
    },
    [serverConfigs, unavailableLabel]
  );

  const playLocalResolvedRow = useCallback(
    (row: import('@asmusic/core').LocalPlaylistResolvedEntry) => {
      const item = queueItemForLocalResolvedRow(row);
      if (item) void insertAfterCurrent([item], { playFirst: true });
    },
    [queueItemForLocalResolvedRow, insertAfterCurrent]
  );

  const playNextLocalResolvedRow = useCallback(
    (row: import('@asmusic/core').LocalPlaylistResolvedEntry) => {
      const item = queueItemForLocalResolvedRow(row);
      if (item) void insertAfterCurrent([item], { playFirst: false });
    },
    [queueItemForLocalResolvedRow, insertAfterCurrent]
  );

  const appendLocalResolvedRowToQueue = useCallback(
    (row: import('@asmusic/core').LocalPlaylistResolvedEntry) => {
      const item = queueItemForLocalResolvedRow(row);
      if (item) void appendToQueue([item]);
    },
    [queueItemForLocalResolvedRow, appendToQueue]
  );

  return {
    playSongEntryNow,
    playTrackNow,
    playNextForSongEntry,
    appendForSongEntry,
    playNextForTrack,
    appendForTrack,
    appendAllSongEntriesToQueue,
    shufflePlayAllSongEntries,
    appendAllAlbumTracksToQueue,
    shufflePlayAllAlbumTracks,
    appendAllArtistTracksToQueue,
    shufflePlayAllArtistTracks,
    appendAllPlaylistTracksToQueue,
    shufflePlayAllPlaylistTracks,
    replaceQueueAndPlayAllPlaylistTracks,
    playLocalResolvedRow,
    playNextLocalResolvedRow,
    appendLocalResolvedRowToQueue,
    replaceQueueAndPlayAllLocalPlaylist,
    appendAllLocalPlaylistToQueue,
    shufflePlayAllLocalPlaylist,
  };
}
