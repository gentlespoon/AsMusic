import { useMemo } from 'react';
import type { Child } from 'subsonic-api';
import {
  albumsFromCachedSongsForArtist,
  songsInCachedAlbum,
  type LibraryCacheScope,
  type LibraryPlaylistSummary,
  type LocalPlaylistEntry,
  type LocalPlaylistSummary,
} from '@asmusic/core';
import type { LibraryBrowseScopeRow, LibraryBrowseSlice } from '@ui/contexts/LibraryBrowseCacheContext';
import {
  decodeLibraryBrowserRef,
  decodeLocalPlaylistRef,
  decodeServerPlaylistRef,
  type LibraryBrowserEncodedRef,
} from './libraryNavigationUrl';

export type LibraryBrowserResolvedAlbum = {
  slice: LibraryBrowseSlice;
  subsonicAlbumId: string;
};

export type LibraryBrowserResolvedArtist = {
  slice: LibraryBrowseSlice;
  subsonicArtistId: string;
};

export type LibraryBrowserResolvedPlaylist =
  | {
      kind: 'server';
      serverId: string;
      serverKey: string;
      subsonicPlaylistId: string;
      summary: LibraryPlaylistSummary | undefined;
      /** All cached songs for this server across active libraries. */
      cachedSongs: Child[];
      findTrackScope: (trackId: string) => LibraryCacheScope | null;
    }
  | {
      kind: 'local';
      localId: string;
      summary: LocalPlaylistSummary | undefined;
      entries: LocalPlaylistEntry[];
    };

function findSliceByDecodedRef(
  slices: LibraryBrowseSlice[],
  decoded: LibraryBrowserEncodedRef
): LibraryBrowseSlice | undefined {
  return slices.find(
    (s) => s.scope.serverKey === decoded.serverKey && s.scope.libraryId === decoded.libraryId
  );
}

function findSliceForSingleLibrary(
  slices: LibraryBrowseSlice[],
  singleSlice: LibraryBrowseScopeRow
): LibraryBrowseSlice | undefined {
  return slices.find(
    (s) => s.serverId === singleSlice.serverId && s.libraryId === singleSlice.libraryId
  );
}

function mergedSongsForServer(slices: LibraryBrowseSlice[], serverKey: string): Child[] {
  const out: Child[] = [];
  const seen = new Set<string>();
  for (const sl of slices) {
    if (sl.scope.serverKey !== serverKey) continue;
    for (const song of sl.songs) {
      const id = String(song.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(song);
    }
  }
  return out;
}

function makeTrackScopeFinder(
  slices: LibraryBrowseSlice[],
  serverKey: string
): (trackId: string) => LibraryCacheScope | null {
  return (trackId: string) => {
    for (const sl of slices) {
      if (sl.scope.serverKey !== serverKey) continue;
      if (sl.songs.some((s) => String(s.id) === trackId)) {
        return sl.scope;
      }
    }
    return null;
  };
}

/**
 * Resolves URL album, artist, and playlist scopes to cached library slices.
 */
export function useLibraryBrowserResolvedScopes(options: {
  albumScope: { id: string } | null;
  artistScope: { id: string } | null;
  playlistScope: { id: string } | null;
  slices: LibraryBrowseSlice[];
  singleSlice: LibraryBrowseScopeRow | null;
  serverPlaylistsByServerKey: Record<string, LibraryPlaylistSummary[]>;
  localPlaylistSummaries: LocalPlaylistSummary[];
  localPlaylistEntriesById: Record<string, LocalPlaylistEntry[]>;
}) {
  const {
    albumScope,
    artistScope,
    playlistScope,
    slices,
    singleSlice,
    serverPlaylistsByServerKey,
    localPlaylistSummaries,
    localPlaylistEntriesById,
  } = options;

  const resolvedAlbum = useMemo((): LibraryBrowserResolvedAlbum | null => {
    if (!albumScope) return null;
    const raw = albumScope.id;
    const decoded = decodeLibraryBrowserRef(raw);
    if (decoded) {
      const sl = findSliceByDecodedRef(slices, decoded);
      if (!sl) return null;
      return { slice: sl, subsonicAlbumId: decoded.id };
    }
    if (singleSlice) {
      const sl = findSliceForSingleLibrary(slices, singleSlice);
      if (!sl) return null;
      return { slice: sl, subsonicAlbumId: raw };
    }
    const hit = slices.find((sl) => songsInCachedAlbum(raw, sl.songs).length > 0);
    if (!hit) return null;
    return { slice: hit, subsonicAlbumId: raw };
  }, [albumScope, slices, singleSlice]);

  const resolvedArtist = useMemo((): LibraryBrowserResolvedArtist | null => {
    if (!artistScope) return null;
    const raw = artistScope.id;
    const decoded = decodeLibraryBrowserRef(raw);
    if (decoded) {
      const sl = findSliceByDecodedRef(slices, decoded);
      if (!sl) return null;
      return { slice: sl, subsonicArtistId: decoded.id };
    }
    if (singleSlice) {
      const sl = findSliceForSingleLibrary(slices, singleSlice);
      if (!sl) return null;
      return { slice: sl, subsonicArtistId: raw };
    }
    const hit = slices.find((sl) => albumsFromCachedSongsForArtist(raw, sl.songs).length > 0);
    if (!hit) return null;
    return { slice: hit, subsonicArtistId: raw };
  }, [artistScope, slices, singleSlice]);

  const resolvedPlaylist = useMemo((): LibraryBrowserResolvedPlaylist | null => {
    if (!playlistScope) return null;
    const raw = playlistScope.id;
    const localDecoded = decodeLocalPlaylistRef(raw);
    if (localDecoded) {
      const summary = localPlaylistSummaries.find((p) => p.id === localDecoded.id);
      if (!summary) return null;
      return {
        kind: 'local',
        localId: localDecoded.id,
        summary,
        entries: localPlaylistEntriesById[localDecoded.id] ?? [],
      };
    }

    const serverDecoded = decodeServerPlaylistRef(raw);
    if (serverDecoded) {
      const slice = slices.find((s) => s.scope.serverKey === serverDecoded.serverKey);
      if (!slice) return null;
      const summary = (serverPlaylistsByServerKey[serverDecoded.serverKey] ?? []).find(
        (p) => p.id === serverDecoded.id
      );
      return {
        kind: 'server',
        serverId: slice.serverId,
        serverKey: serverDecoded.serverKey,
        subsonicPlaylistId: serverDecoded.id,
        summary,
        cachedSongs: mergedSongsForServer(slices, serverDecoded.serverKey),
        findTrackScope: makeTrackScopeFinder(slices, serverDecoded.serverKey),
      };
    }

    const legacyDecoded = decodeLibraryBrowserRef(raw);
    if (legacyDecoded) {
      const slice = slices.find((s) => s.scope.serverKey === legacyDecoded.serverKey);
      if (!slice) return null;
      const summary = (serverPlaylistsByServerKey[legacyDecoded.serverKey] ?? []).find(
        (p) => p.id === legacyDecoded.id
      );
      return {
        kind: 'server',
        serverId: slice.serverId,
        serverKey: legacyDecoded.serverKey,
        subsonicPlaylistId: legacyDecoded.id,
        summary,
        cachedSongs: mergedSongsForServer(slices, legacyDecoded.serverKey),
        findTrackScope: makeTrackScopeFinder(slices, legacyDecoded.serverKey),
      };
    }

    if (singleSlice) {
      const slice = findSliceForSingleLibrary(slices, singleSlice);
      if (!slice) return null;
      const summary = (serverPlaylistsByServerKey[singleSlice.scope.serverKey] ?? []).find(
        (p) => p.id === raw
      );
      return {
        kind: 'server',
        serverId: slice.serverId,
        serverKey: singleSlice.scope.serverKey,
        subsonicPlaylistId: raw,
        summary,
        cachedSongs: mergedSongsForServer(slices, singleSlice.scope.serverKey),
        findTrackScope: makeTrackScopeFinder(slices, singleSlice.scope.serverKey),
      };
    }

    for (const sl of slices) {
      const summary = (serverPlaylistsByServerKey[sl.scope.serverKey] ?? []).find((p) => p.id === raw);
      if (!summary) continue;
      return {
        kind: 'server',
        serverId: sl.serverId,
        serverKey: sl.scope.serverKey,
        subsonicPlaylistId: raw,
        summary,
        cachedSongs: mergedSongsForServer(slices, sl.scope.serverKey),
        findTrackScope: makeTrackScopeFinder(slices, sl.scope.serverKey),
      };
    }
    return null;
  }, [playlistScope, slices, singleSlice, serverPlaylistsByServerKey, localPlaylistSummaries, localPlaylistEntriesById]);

  return { resolvedAlbum, resolvedArtist, resolvedPlaylist };
}
