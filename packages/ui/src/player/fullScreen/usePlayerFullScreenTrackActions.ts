import { useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import { useLibraryBrowseCache } from "../../contexts";
import type { PlaylistCatalogRow } from "../../contexts/LibraryBrowseCacheContext";
import { usePlayerActions } from "../../contexts/PlayerContext";
import type { PlayerQueueItem } from "../core/types";

export type PlayerFullScreenTrackActions = {
  isStarred: boolean;
  starBusy: boolean;
  starError: string | null;
  clearStarError: () => void;
  toggleStarred: () => void;
  addToPlaylistOpen: boolean;
  setAddToPlaylistOpen: (open: boolean) => void;
  addToPlaylistError: string | null;
  clearAddToPlaylistError: () => void;
  addToPlaylistBusy: boolean;
  canAddToPlaylist: boolean;
  playlistsForCurrentTrack: PlaylistCatalogRow[];
  addToPlaylist: (row: PlaylistCatalogRow) => void;
};

export function usePlayerFullScreenTrackActions(
  item: PlayerQueueItem | null,
): PlayerFullScreenTrackActions {
  const t = useT();
  const { patchCurrentQueueItemStarred } = usePlayerActions();
  const { setTrackStarred, playlistCatalogRows, addTrackToPlaylist, singleSlice } =
    useLibraryBrowseCache();
  const canAddToPlaylist = singleSlice != null;

  const [starBusy, setStarBusy] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [addToPlaylistError, setAddToPlaylistError] = useState<string | null>(
    null,
  );
  const [addToPlaylistBusy, setAddToPlaylistBusy] = useState(false);

  const isStarred = Boolean(item?.starred);

  const playlistsForCurrentTrack = item
    ? playlistCatalogRows.filter(
        (r) => r.serverId === item.serverId && r.libraryId === item.libraryId,
      )
    : [];

  useEffect(() => {
    setStarError(null);
    setAddToPlaylistError(null);
  }, [item?.rowId]);

  const toggleStarred = () => {
    if (!item) return;
    setStarError(null);
    setStarBusy(true);
    const next = !isStarred;
    void setTrackStarred({
      serverId: item.serverId,
      libraryId: item.libraryId,
      trackId: item.trackId,
      starred: next,
    })
      .then(() => {
        patchCurrentQueueItemStarred(next);
      })
      .catch((e: unknown) => {
        setStarError(
          e instanceof Error
            ? e.message
            : t("player.favorite.couldNotUpdate"),
        );
      })
      .finally(() => setStarBusy(false));
  };

  const addToPlaylist = (row: PlaylistCatalogRow) => {
    if (!item || !canAddToPlaylist) return;
    setAddToPlaylistBusy(true);
    setAddToPlaylistError(null);
    void addTrackToPlaylist({
      serverId: item.serverId,
      libraryId: item.libraryId,
      playlistId: row.playlist.id,
      trackId: item.trackId,
    })
      .catch((e: unknown) => {
        setAddToPlaylistError(
          e instanceof Error ? e.message : t("player.addToPlaylist.couldNotAdd"),
        );
      })
      .finally(() => setAddToPlaylistBusy(false));
  };

  return {
    isStarred,
    starBusy,
    starError,
    clearStarError: () => setStarError(null),
    toggleStarred,
    addToPlaylistOpen,
    setAddToPlaylistOpen,
    addToPlaylistError,
    clearAddToPlaylistError: () => setAddToPlaylistError(null),
    addToPlaylistBusy,
    canAddToPlaylist,
    playlistsForCurrentTrack,
    addToPlaylist,
  };
}
