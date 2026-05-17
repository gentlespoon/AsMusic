import { useCallback, useMemo } from 'react';
import type { AlbumID3, Child } from 'subsonic-api';
import { songsInCachedAlbum } from '@asmusic/core';
import { usePlayerActions, useServerAndLibrary } from '../../../../contexts';
import { playerQueueItemFromChild } from '../../../../player/core/playerQueueItemFromChild';
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
}) {
  const { resolvedAlbum, resolvedArtist, resolvedPlaylist } = options;
  const { servers } = useServerAndLibrary();
  const { insertAfterCurrent, appendToQueue, replaceQueueAndPlay } = usePlayerActions();

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

  const queueItemsForArtistAlbum = useCallback(
    (album: AlbumID3): PlayerQueueItem[] => {
      if (!resolvedArtist) return [];
      const tracks = songsInCachedAlbum(String(album.id), resolvedArtist.slice.songs);
      const meta = serverMetaById[resolvedArtist.slice.serverId];
      if (!meta) return [];
      return tracks.map((song) =>
        playerQueueItemFromChild({
          song,
          serverId: resolvedArtist.slice.serverId,
          libraryId: resolvedArtist.slice.libraryId,
          serverUrl: meta.serverUrl,
          username: meta.username,
        })
      );
    },
    [resolvedArtist, serverMetaById]
  );

  const playNextForArtistAlbum = useCallback(
    (album: AlbumID3) => {
      const items = queueItemsForArtistAlbum(album);
      if (items.length === 0) return;
      void insertAfterCurrent(items, { playFirst: false });
    },
    [queueItemsForArtistAlbum, insertAfterCurrent]
  );

  const appendArtistAlbumToQueue = useCallback(
    (album: AlbumID3) => {
      const items = queueItemsForArtistAlbum(album);
      if (items.length === 0) return;
      void appendToQueue(items);
    },
    [queueItemsForArtistAlbum, appendToQueue]
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
      const meta = serverMetaById[resolvedPlaylist.slice.serverId];
      if (!meta) return [];
      const items: PlayerQueueItem[] = [];
      for (const t of tracks) {
        const it = playerQueueItemFromChild({
          song: t,
          serverId: resolvedPlaylist.slice.serverId,
          libraryId: resolvedPlaylist.slice.libraryId,
          serverUrl: meta.serverUrl,
          username: meta.username,
        });
        items.push(it);
      }
      return items;
    },
    [resolvedPlaylist, serverMetaById]
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

  return {
    playSongEntryNow,
    playTrackNow,
    playNextForSongEntry,
    appendForSongEntry,
    playNextForTrack,
    appendForTrack,
    appendAllSongEntriesToQueue,
    shufflePlayAllSongEntries,
    playNextForArtistAlbum,
    appendArtistAlbumToQueue,
    appendAllAlbumTracksToQueue,
    shufflePlayAllAlbumTracks,
    appendAllArtistTracksToQueue,
    shufflePlayAllArtistTracks,
    appendAllPlaylistTracksToQueue,
    shufflePlayAllPlaylistTracks,
    replaceQueueAndPlayAllPlaylistTracks,
  };
}
