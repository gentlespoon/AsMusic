import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Child } from "subsonic-api";
import {
  derivedAlbumIdForCachedSong,
  derivedArtistIdForCachedSong,
} from "@asmusic/core";
import {
  encodeLibraryBrowserRef,
  mergeLibraryBrowserSearchParams,
} from "../../views/home/library/browser/libraryNavigationUrl";
import { useLibraryBrowseCache } from "../../contexts";
import { usePlayerActions } from "../../contexts/PlayerContext";
import type { PlayerQueueItem } from "../core/types";

function albumIdFallback(item: PlayerQueueItem): string | null {
  const title = item.album?.trim();
  if (!title) return null;
  const artist = item.artist?.trim() ?? "";
  return `album:${title.toLowerCase()}|${artist.toLowerCase()}`;
}

function artistIdFallback(item: PlayerQueueItem): string | null {
  const name = item.artist?.trim();
  if (!name) return null;
  return `name:${name.toLowerCase()}`;
}

export function usePlayerLibraryNavigation() {
  const navigate = useNavigate();
  const { closeFullPlayer } = usePlayerActions();
  const { slices, multiLibrary } = useLibraryBrowseCache();

  const resolveCachedSong = useCallback(
    (item: PlayerQueueItem): Child | null => {
      const slice = slices.find(
        (s) =>
          s.serverId === item.serverId && s.libraryId === item.libraryId,
      );
      if (!slice) return null;
      return slice.songs.find((s) => String(s.id) === item.trackId) ?? null;
    },
    [slices],
  );

  const encodeEntityId = useCallback(
    (item: PlayerQueueItem, entityId: string) => {
      if (!multiLibrary) return entityId;
      const slice = slices.find(
        (s) =>
          s.serverId === item.serverId && s.libraryId === item.libraryId,
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
    (
      view: Parameters<typeof mergeLibraryBrowserSearchParams>[1],
    ) => {
      closeFullPlayer();
      const params = mergeLibraryBrowserSearchParams(
        new URLSearchParams(),
        view,
      );
      navigate({ pathname: "/", search: params.toString() });
    },
    [closeFullPlayer, navigate],
  );

  const openAlbum = useCallback(
    (item: PlayerQueueItem) => {
      const song = resolveCachedSong(item);
      const albumId = song
        ? derivedAlbumIdForCachedSong(song)
        : albumIdFallback(item);
      if (!albumId) return;
      navigateToLibrary({
        tab: "songs",
        album: { id: encodeEntityId(item, albumId) },
        artist: null,
        playlist: null,
      });
    },
    [encodeEntityId, navigateToLibrary, resolveCachedSong],
  );

  const openArtist = useCallback(
    (item: PlayerQueueItem) => {
      const song = resolveCachedSong(item);
      const artistId = song
        ? derivedArtistIdForCachedSong(song)
        : artistIdFallback(item);
      const artistName = item.artist?.trim();
      if (!artistId || !artistName) return;
      navigateToLibrary({
        tab: "albums",
        album: null,
        artist: {
          id: encodeEntityId(item, artistId),
          name: artistName,
          allSongs: false,
        },
        playlist: null,
      });
    },
    [encodeEntityId, navigateToLibrary, resolveCachedSong],
  );

  return { openAlbum, openArtist };
}
