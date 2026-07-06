import { useMemo } from 'react';
import {
  albumsFromCachedSongsForArtist,
  songsInCachedAlbum,
  type LibraryPlaylistSummary,
  type LocalPlaylistEntry,
  type LocalPlaylistSummary,
} from '@asmusic/core';
import type { LibraryBrowseScopeRow, LibraryBrowseSlice } from '@ui/contexts/LibraryBrowseCacheContext';
import {
  decodeLibraryBrowserRef,
  decodeLocalPlaylistRef,
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
      slice: LibraryBrowseSlice;
      subsonicPlaylistId: string;
      summary: LibraryPlaylistSummary | undefined;
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

/**
 * Resolves URL album, artist, and playlist scopes to cached library slices.
 */
export function useLibraryBrowserResolvedScopes(options: {
  albumScope: { id: string } | null;
  artistScope: { id: string } | null;
  playlistScope: { id: string } | null;
  slices: LibraryBrowseSlice[];
  singleSlice: LibraryBrowseScopeRow | null;
  localPlaylistSummaries: LocalPlaylistSummary[];
  localPlaylistEntriesById: Record<string, LocalPlaylistEntry[]>;
}) {
  const {
    albumScope,
    artistScope,
    playlistScope,
    slices,
    singleSlice,
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
    const decoded = decodeLibraryBrowserRef(raw);
    if (decoded) {
      const sl = findSliceByDecodedRef(slices, decoded);
      if (!sl) return null;
      const summary = sl.playlists.find((p) => p.id === decoded.id);
      return { kind: 'server', slice: sl, subsonicPlaylistId: decoded.id, summary };
    }
    if (singleSlice) {
      const sl = findSliceForSingleLibrary(slices, singleSlice);
      if (!sl) return null;
      const summary = sl.playlists.find((p) => p.id === raw);
      return { kind: 'server', slice: sl, subsonicPlaylistId: raw, summary };
    }
    const hit = slices.find((sl) => sl.playlists.some((p) => p.id === raw));
    if (!hit) return null;
    const summary = hit.playlists.find((p) => p.id === raw);
    return { kind: 'server', slice: hit, subsonicPlaylistId: raw, summary };
  }, [playlistScope, slices, singleSlice, localPlaylistSummaries, localPlaylistEntriesById]);

  return { resolvedAlbum, resolvedArtist, resolvedPlaylist };
}
