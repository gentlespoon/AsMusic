import { useMemo } from 'react';
import { albumsFromCachedSongsForArtist, songsInCachedAlbum, type LibraryPlaylistSummary } from '@asmusic/core';
import type { LibraryBrowseScopeRow, LibraryBrowseSlice } from '../../../../contexts/LibraryBrowseCacheContext';
import { decodeLibraryBrowserRef, type LibraryBrowserEncodedRef } from './libraryNavigationUrl';

export type LibraryBrowserResolvedAlbum = {
  slice: LibraryBrowseSlice;
  subsonicAlbumId: string;
};

export type LibraryBrowserResolvedArtist = {
  slice: LibraryBrowseSlice;
  subsonicArtistId: string;
};

export type LibraryBrowserResolvedPlaylist = {
  slice: LibraryBrowseSlice;
  subsonicPlaylistId: string;
  summary: LibraryPlaylistSummary | undefined;
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
}) {
  const { albumScope, artistScope, playlistScope, slices, singleSlice } = options;

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
    const decoded = decodeLibraryBrowserRef(raw);
    if (decoded) {
      const sl = findSliceByDecodedRef(slices, decoded);
      if (!sl) return null;
      const summary = sl.playlists.find((p) => p.id === decoded.id);
      return { slice: sl, subsonicPlaylistId: decoded.id, summary };
    }
    if (singleSlice) {
      const sl = findSliceForSingleLibrary(slices, singleSlice);
      if (!sl) return null;
      const summary = sl.playlists.find((p) => p.id === raw);
      return { slice: sl, subsonicPlaylistId: raw, summary };
    }
    const hit = slices.find((sl) => sl.playlists.some((p) => p.id === raw));
    if (!hit) return null;
    const summary = hit.playlists.find((p) => p.id === raw);
    return { slice: hit, subsonicPlaylistId: raw, summary };
  }, [playlistScope, slices, singleSlice]);

  return { resolvedAlbum, resolvedArtist, resolvedPlaylist };
}
