import { useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import { libraryCacheScope, localPlaylistTrackRefFromChild } from "@asmusic/core";
import { useLibraryBrowseCache } from "../../contexts";
import type { PlaylistCatalogRow } from "../../contexts/LibraryBrowseCacheContext";
import { usePlayerActions } from "../../contexts/PlayerContext";
import { useServerAndLibrary } from "../../contexts/ServerAndLibraryContext";
import { useHost } from "../../host/HostContext";
import type { PlayerQueueItem } from "../core/types";
import { playerQueueItemArtworkScope } from "../shared/resolvePlayerCachedArtwork";

const REFRESH_COVER_ART_SIZE = 512;

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
  canRefreshCoverArt: boolean;
  refreshCoverArtBusy: boolean;
  refreshCoverArtError: string | null;
  clearRefreshCoverArtError: () => void;
  refreshCoverArt: () => void;
};

export function usePlayerFullScreenTrackActions(
  item: PlayerQueueItem | null,
): PlayerFullScreenTrackActions {
  const t = useT();
  const host = useHost();
  const { getApiForServer } = useServerAndLibrary();
  const { patchCurrentQueueItemStarred } = usePlayerActions();
  const {
    setTrackStarred,
    playlistCatalogRows,
    addTrackToPlaylist,
    addTrackToLocalPlaylist,
    notifyArtworkCached,
    artworkVersionKey,
  } = useLibraryBrowseCache();

  const [starBusy, setStarBusy] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [addToPlaylistError, setAddToPlaylistError] = useState<string | null>(null);
  const [addToPlaylistBusy, setAddToPlaylistBusy] = useState(false);
  const [refreshCoverArtBusy, setRefreshCoverArtBusy] = useState(false);
  const [refreshCoverArtError, setRefreshCoverArtError] = useState<string | null>(null);

  const isStarred = Boolean(item?.starred);

  const serverPlaylistsForTrack = item
    ? playlistCatalogRows.filter(
        (r) =>
          r.kind === "server" &&
          r.serverId === item.serverId &&
          r.libraryId === item.libraryId,
      )
    : [];
  const localPlaylists = playlistCatalogRows.filter((r) => r.kind === "local");
  const playlistsForCurrentTrack = [...localPlaylists, ...serverPlaylistsForTrack];
  const canAddToPlaylist =
    playlistsForCurrentTrack.length > 0 && Boolean(item?.serverId && item.trackId);

  const canRefreshCoverArt = Boolean(item?.coverArtId?.trim());

  useEffect(() => {
    setStarError(null);
    setAddToPlaylistError(null);
    setRefreshCoverArtError(null);
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
          e instanceof Error ? e.message : t("player.favorite.couldNotUpdate"),
        );
      })
      .finally(() => setStarBusy(false));
  };

  const refreshCoverArt = () => {
    if (!item?.coverArtId?.trim()) return;
    const coverArtId = item.coverArtId.trim();
    const scope = playerQueueItemArtworkScope(item);
    setRefreshCoverArtError(null);
    setRefreshCoverArtBusy(true);
    void (async () => {
      try {
        const api = await getApiForServer(item.serverId);
        if (!api) {
          throw new Error(t("servers.error.noSession", { url: item.serverUrl }));
        }
        const res = await api.getCoverArt({
          id: coverArtId,
          size: REFRESH_COVER_ART_SIZE,
        });
        if (!res.ok) {
          throw new Error(t("player.coverArt.couldNotRefresh"));
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length === 0) {
          throw new Error(t("player.coverArt.couldNotRefresh"));
        }
        const mimeType =
          res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        await host.libraryCache.putArtworkBlob(scope, {
          coverArtId,
          data: buf,
          mimeType,
        });
        notifyArtworkCached(artworkVersionKey(coverArtId, scope));
      } catch (e: unknown) {
        setRefreshCoverArtError(
          e instanceof Error ? e.message : t("player.coverArt.couldNotRefresh"),
        );
      } finally {
        setRefreshCoverArtBusy(false);
      }
    })();
  };

  const addToPlaylist = (row: PlaylistCatalogRow) => {
    if (!item || !canAddToPlaylist) return;
    setAddToPlaylistBusy(true);
    setAddToPlaylistError(null);
    const task =
      row.kind === "local"
        ? addTrackToLocalPlaylist({
            playlistId: row.playlist.id,
            ref: localPlaylistTrackRefFromChild(
              libraryCacheScope(item.serverUrl, item.username, item.libraryId),
              {
                id: item.trackId,
                isDir: false,
                title: item.title,
                artist: item.artist,
                album: item.album,
                coverArt: item.coverArtId,
              },
            ),
          })
        : addTrackToPlaylist({
            serverId: item.serverId,
            libraryId: item.libraryId,
            playlistId: row.playlist.id,
            trackId: item.trackId,
          });
    void task
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
    canRefreshCoverArt,
    refreshCoverArtBusy,
    refreshCoverArtError,
    clearRefreshCoverArtError: () => setRefreshCoverArtError(null),
    refreshCoverArt,
  };
}
