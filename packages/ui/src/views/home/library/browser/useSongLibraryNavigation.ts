import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Child } from "subsonic-api";
import {
  derivedAlbumIdForCachedSong,
  derivedArtistIdForCachedSong,
} from "@asmusic/core";
import { useLibraryBrowseCache } from "@ui/contexts";
import {
  encodeLibraryBrowserRef,
  mergeLibraryBrowserSearchParams,
} from "./libraryNavigationUrl";

function artistDisplayName(song: Child): string | null {
  const name =
    song.displayArtist?.trim() ||
    song.artist?.trim() ||
    song.artists?.[0]?.name?.trim() ||
    "";
  return name.length > 0 ? name : null;
}

function albumDisplayName(song: Child): string | null {
  const name = song.album?.trim() || "";
  return name.length > 0 ? name : null;
}

export function songHasViewableArtist(song: Child): boolean {
  return Boolean(derivedArtistIdForCachedSong(song) && artistDisplayName(song));
}

export function songHasViewableAlbum(song: Child): boolean {
  return Boolean(albumDisplayName(song) || song.albumId?.trim());
}

/**
 * Navigate from a song row to its artist or album in the library browser.
 */
export function useSongLibraryNavigation() {
  const navigate = useNavigate();
  const { slices, multiLibrary } = useLibraryBrowseCache();

  const encodeEntityId = useCallback(
    (serverId: string, libraryId: string, entityId: string) => {
      if (!multiLibrary) return entityId;
      const slice = slices.find(
        (s) => s.serverId === serverId && s.libraryId === libraryId,
      );
      if (!slice) return entityId;
      return encodeLibraryBrowserRef({
        serverKey: slice.scope.serverKey,
        libraryId: slice.libraryId,
        id: entityId,
      });
    },
    [multiLibrary, slices],
  );

  const navigateToLibrary = useCallback(
    (view: Parameters<typeof mergeLibraryBrowserSearchParams>[1]) => {
      const params = mergeLibraryBrowserSearchParams(
        new URLSearchParams(),
        view,
      );
      navigate({ pathname: "/", search: params.toString() });
    },
    [navigate],
  );

  const openArtistForSong = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      const artistId = derivedArtistIdForCachedSong(song);
      const artistName = artistDisplayName(song);
      if (!artistId || !artistName) return;
      navigateToLibrary({
        tab: "albums",
        album: null,
        artist: {
          id: encodeEntityId(serverId, libraryId, artistId),
          name: artistName,
          allSongs: false,
        },
        playlist: null,
        recommendations: null,
      });
    },
    [encodeEntityId, navigateToLibrary],
  );

  const openAlbumForSong = useCallback(
    (serverId: string, libraryId: string, song: Child) => {
      if (!songHasViewableAlbum(song)) return;
      const albumId = derivedAlbumIdForCachedSong(song);
      if (!albumId) return;
      navigateToLibrary({
        tab: "songs",
        album: { id: encodeEntityId(serverId, libraryId, albumId) },
        artist: null,
        playlist: null,
        recommendations: null,
      });
    },
    [encodeEntityId, navigateToLibrary],
  );

  return {
    openArtistForSong,
    openAlbumForSong,
  };
}
