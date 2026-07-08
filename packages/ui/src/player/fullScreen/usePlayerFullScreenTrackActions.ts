import { useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import { CANONICAL_COVER_ART_SIZE, libraryCacheScope, localPlaylistTrackRefFromChild } from "@asmusic/core";
import { artworkDisplayMimeType, isValidImageBytes } from "@ui/shared/artworkDisplayMimeType";
import { useLibraryBrowseCache } from "@ui/contexts";
import type { PlaylistCatalogRow } from "@ui/contexts/LibraryBrowseCacheContext";
import { usePlayerActions } from "@ui/contexts/PlayerContext";
import { useServerAndLibrary } from "@ui/contexts/ServerAndLibraryContext";
import { useHost } from "@ui/host/HostContext";
import type { PlayerQueueItem } from "@ui/player/core/types";
import {
  playerQueueItemArtworkScope,
  resolveCoverArtIdsToTryForQueueItem,
} from "@ui/player/shared/resolvePlayerCachedArtwork";

export type PlayerFullScreenTrackActions = {
  isStarred: boolean;
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
  const { patchCurrentQueueItemStarred, syncCurrentTrackNowPlayingArtwork } = usePlayerActions();
  const {
    setTrackStarred,
    playlistCatalogRows,
    addTrackToPlaylist,
    addTrackToLocalPlaylist,
    notifyArtworkCached,
    artworkVersionKey,
    slices,
    albumCatalogRows,
  } = useLibraryBrowseCache();

  const [starError, setStarError] = useState<string | null>(null);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [addToPlaylistError, setAddToPlaylistError] = useState<string | null>(null);
  const [addToPlaylistBusy, setAddToPlaylistBusy] = useState(false);
  const [refreshCoverArtBusy, setRefreshCoverArtBusy] = useState(false);
  const [refreshCoverArtError, setRefreshCoverArtError] = useState<string | null>(null);

  const isStarred = Boolean(item?.starred);

  const serverPlaylistsForTrack = item
    ? playlistCatalogRows.filter(
        (r) => r.kind === "server" && r.serverId === item.serverId,
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
    const next = !isStarred;
    patchCurrentQueueItemStarred(next);
    void setTrackStarred({
      serverId: item.serverId,
      libraryId: item.libraryId,
      trackId: item.trackId,
      starred: next,
    }).catch((e: unknown) => {
      patchCurrentQueueItemStarred(!next);
      setStarError(
        e instanceof Error ? e.message : t("player.favorite.couldNotUpdate"),
      );
    });
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
        const idsToTry = resolveCoverArtIdsToTryForQueueItem(item, {
          slices,
          albumCatalogRows,
        });
        for (const tryId of idsToTry) {
          const res = await api.getCoverArt({
            id: tryId,
            size: CANONICAL_COVER_ART_SIZE,
          });
          if (!res.ok) continue;
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.length === 0) continue;
          if (!isValidImageBytes(buf)) continue;
          const mimeType = artworkDisplayMimeType(
            buf,
            res.headers.get("content-type") ?? undefined,
          );
          await host.libraryCache.putArtworkBlob(scope, {
            coverArtId,
            data: buf,
            mimeType,
          });
          notifyArtworkCached(artworkVersionKey(coverArtId, scope));
          try {
            await syncCurrentTrackNowPlayingArtwork();
          } catch {
            // Cache refresh succeeded; lock-screen artwork sync is best-effort.
          }
          return;
        }
        throw new Error(t("player.coverArt.couldNotRefresh"));
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
