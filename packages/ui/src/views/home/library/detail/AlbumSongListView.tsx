import { useT } from "@asmusic/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumID3, Child } from "subsonic-api";
import DownloadIcon from "@mui/icons-material/Download";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import Shuffle from "@mui/icons-material/Shuffle";
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  LibraryDetailTitle,
  libraryDetailHeaderStackSx,
} from '../shared/libraryTypography';
import { PageCloseButton } from "../../../../shared/PageCloseButton";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  resolveCoverArtIdForCachedSong,
  isChildStarred,
  type LibraryArtworkCacheRow,
  type SubsonicAPI,
} from "@asmusic/core";
import { useOfflineDownload } from "../../../../contexts/OfflineDownloadContext";
import { SongItem } from "../../../../shared/SongItem";
import type { PersistCachedArtwork } from "../../../../shared/libraryArtworkCacheAccess";
import { songMatchesQuery } from "../../../../shared/songSearch";
import { LibraryVirtuosoFill, libraryFlexFillSx } from "../../../../shared/LibraryVirtuosoFill";
import { useLibraryScrollRestoration } from "../../../../shared/useLibraryScrollRestoration";
import { useLibraryVirtuosoScroller } from "../../../../shared/useLibraryVirtuosoScroller";
import { VirtuosoMuiList } from "../../../../shared/virtuosoMuiList";
import { useEdgeSwipeBack } from "../../../../shared/useEdgeSwipeBack";

export function AlbumSongListView({
  albumId,
  albumTitle,
  tracks,
  albums,
  api,
  initialReady,
  syncing,
  resolveCachedArtwork,
  persistCachedArtwork,
  coverArtCacheBump,
  artworkCacheKeyFor,
  scrollRestorationKey,
  serverId,
  libraryId,
  onBack,
  onPlayTrack,
  onPlayNextTrack,
  onAppendTrackToQueue,
  onAppendAllToQueue,
  onShufflePlayAll,
  setTrackStarred,
}: {
  albumId: string;
  /** Stable id for scroll memory (URL album id, including encoded multi-library refs). */
  scrollRestorationKey: string;
  albumTitle: string;
  tracks: Child[];
  albums: AlbumID3[];
  api: SubsonicAPI;
  initialReady: boolean;
  syncing: boolean;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  coverArtCacheBump?: (coverArtId: string | undefined) => number;
  artworkCacheKeyFor?: (coverArtId: string) => string;
  serverId: string;
  libraryId: string;
  onBack: () => void;
  /** Primary row action: play this track next without replacing the queue. */
  onPlayTrack?: (track: Child) => void;
  onPlayNextTrack?: (track: Child) => void;
  onAppendTrackToQueue?: (track: Child) => void;
  /** Append every track currently shown (respects the search filter). */
  onAppendAllToQueue?: (tracks: Child[]) => void;
  /** Replace the queue with a shuffled copy of the tracks currently shown, then play. */
  onShufflePlayAll?: (tracks: Child[]) => void;
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
}) {
  const t = useT();
  const { enqueueAlbumDownload } = useOfflineDownload();
  const bumpFor = coverArtCacheBump ?? (() => 0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [albumId]);

  const filteredTracks = useMemo(
    () => tracks.filter((t) => songMatchesQuery(t, search)),
    [tracks, search],
  );

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration(
    `lb:albumTracks:${scrollRestorationKey}`,
  );
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: "start" });
  }, [search]);

  const onDownloadAlbumOffline = useCallback(() => {
    enqueueAlbumDownload({
      serverId,
      libraryId,
      albumTitle,
      trackIds: tracks.map((t) => String(t.id)),
    });
  }, [enqueueAlbumDownload, serverId, libraryId, albumTitle, tracks]);

  const edgeSwipeBack = useEdgeSwipeBack(onBack);

  return (
    <Box
      role="tabpanel"
      id="library-panel-2"
      aria-labelledby="library-tab-2"
      {...edgeSwipeBack}
      sx={{
        ...libraryFlexFillSx,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Stack sx={libraryDetailHeaderStackSx}>
        <PageCloseButton
          edge="start"
          onClick={onBack}
          sx={{ alignSelf: "flex-start" }}
        />
        <LibraryDetailTitle>{albumTitle}</LibraryDetailTitle>
        <Tooltip title={t("library.album.downloadOffline")}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t("library.album.downloadOffline")}
              onClick={onDownloadAlbumOffline}
              disabled={!initialReady || tracks.length === 0}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ flexShrink: 0, mb: 2, alignItems: "center" }}
      >
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("library.album.searchInAlbum")}
          aria-label={t("library.album.filterInAlbum")}
          fullWidth
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
        />
        {onAppendAllToQueue && (
          <Tooltip title={t("player.action.addAllToQueue")}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t("player.action.addAllToQueue")}
                disabled={!initialReady || filteredTracks.length === 0}
                onClick={() => onAppendAllToQueue(filteredTracks)}
              >
                <PlaylistAdd fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {onShufflePlayAll && (
          <Tooltip title={t("player.action.shuffleAll")}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t("player.action.shuffleAll")}
                disabled={!initialReady || filteredTracks.length === 0}
                onClick={() => onShufflePlayAll(filteredTracks)}
              >
                <Shuffle fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>

      <Box
        sx={{ ...libraryFlexFillSx, display: "flex", flexDirection: "column" }}
      >
        {!initialReady && (
          <Typography variant="body2" color="text.secondary">
            {t("library.cache.loading")}
          </Typography>
        )}
        {initialReady && tracks.length === 0 && !syncing && (
          <Typography variant="body2" color="text.secondary">
            {t("library.album.noTracksInCache")}
          </Typography>
        )}
        {initialReady &&
          tracks.length > 0 &&
          filteredTracks.length === 0 &&
          queryTrimmed.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("library.playlist.noTracksMatch")}
            </Typography>
          )}
        {initialReady && filteredTracks.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: "100%", width: "100%", minHeight: 0 }}
              data={filteredTracks}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_, track) => String(track.id)}
              itemContent={(_, track) => {
                const coverId = resolveCoverArtIdForCachedSong(
                  track,
                  albums,
                );
                return (
                  <SongItem
                    track={track}
                    coverArtId={coverId}
                    api={api}
                    resolveCachedArtwork={resolveCachedArtwork}
                    persistCachedArtwork={persistCachedArtwork}
                    artworkCacheBump={bumpFor(coverId)}
                    artworkCacheKey={
                      coverId && artworkCacheKeyFor ? artworkCacheKeyFor(coverId) : undefined
                    }
                    includeAlbumInSecondary={false}
                    onClick={onPlayTrack ? () => onPlayTrack(track) : undefined}
                    onPlayNext={
                      onPlayNextTrack ? () => onPlayNextTrack(track) : undefined
                    }
                    onAppendToQueue={
                      onAppendTrackToQueue
                        ? () => onAppendTrackToQueue(track)
                        : undefined
                    }
                    isStarred={setTrackStarred ? isChildStarred(track) : undefined}
                    onToggleStar={
                      setTrackStarred
                        ? () =>
                            setTrackStarred({
                              serverId,
                              libraryId,
                              trackId: String(track.id),
                              starred: !isChildStarred(track),
                            })
                        : undefined
                    }
                  />
                );
              }}
            />
          </LibraryVirtuosoFill>
        )}
      </Box>
    </Box>
  );
}
