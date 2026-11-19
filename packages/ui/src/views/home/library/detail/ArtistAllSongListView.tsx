import { useI18n, useT } from "@asmusic/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AlbumID3, Child } from "subsonic-api";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import Shuffle from "@mui/icons-material/Shuffle";
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import { Virtuoso } from "react-virtuoso";
import {
  resolveCoverArtIdsForCachedSong,
  indexAlbumsById,
  isChildStarred,
  type LibraryArtworkCacheRow,
  type SubsonicAPI,
} from "@asmusic/core";
import { SongItem } from "@ui/shared/songItem";
import type { PersistCachedArtwork } from "@ui/shared/libraryArtworkCacheAccess";
import { songMatchesQuery } from "@ui/shared/songSearch";
import { LibraryVirtuosoFill, libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { useLibraryVirtuosoScroller } from "@ui/shared/useLibraryVirtuosoScroller";
import { useBoundedListData } from "@ui/shared/useBoundedListData";
import { VirtuosoMuiList } from "@ui/shared/virtuosoMuiList";
import {
  songHasViewableAlbum,
} from "../browser/useSongLibraryNavigation";

export function ArtistAllSongListView({
  artistName,
  scrollRestorationKey,
  tracks,
  albums,
  api,
  initialReady,
  resolveCachedArtwork,
  persistCachedArtwork,
  coverArtCacheBump,
  artworkCacheKeyFor,
  onBack,
  onPlayTrack,
  onPlayNextTrack,
  onAppendTrackToQueue,
  onViewAlbum,
  onAppendAllToQueue,
  onShufflePlayAll,
  serverId,
  libraryId,
  setTrackStarred,
}: {
  artistName: string;
  /** Stable id for scroll memory (URL artist id, including encoded multi-library refs). */
  scrollRestorationKey: string;
  tracks: Child[];
  albums: AlbumID3[];
  api: SubsonicAPI;
  initialReady: boolean;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  coverArtCacheBump?: (coverArtId: string | undefined) => number;
  artworkCacheKeyFor?: (coverArtId: string) => string;
  onBack: () => void;
  /** Primary row action: play this track next without replacing the queue. */
  onPlayTrack?: (track: Child) => void;
  onPlayNextTrack?: (track: Child) => void;
  onAppendTrackToQueue?: (track: Child) => void;
  onViewAlbum?: (track: Child) => void;
  /** Append every track currently shown (respects the search filter). */
  onAppendAllToQueue?: (tracks: Child[]) => void;
  /** Replace the queue with a shuffled copy of the tracks currently shown, then play. */
  onShufflePlayAll?: (tracks: Child[]) => void;
  serverId: string;
  libraryId: string;
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
}) {
  const t = useT();
  const { format } = useI18n();
  const bumpFor = coverArtCacheBump ?? (() => 0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [scrollRestorationKey]);

  const filteredTracks = useMemo(() => {
    if (!search.trim()) return tracks;
    return tracks.filter((t) => songMatchesQuery(t, search));
  }, [tracks, search]);

  const albumsById = useMemo(() => indexAlbumsById(albums), [albums]);

  const queryTrimmed = search.trim();

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const bounded = useBoundedListData(filteredTracks, {
    memoryKey: `lb:artistAllSongs:${scrollRestorationKey}`,
    resetKey: search,
  });

  return (
    <Box
      role="tabpanel"
      id="library-panel-1"
      aria-labelledby="library-tab-1"
      sx={{
        ...libraryFlexFillSx,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Stack spacing={1} sx={{ flexShrink: 0, mb: 2 }}>
        <PageCloseButton
          edge="start"
          onClick={onBack}
          sx={{ alignSelf: "flex-start" }}
        />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {artistName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("library.album.allSongs")}
          {tracks.length > 0
            ? ` · ${t("library.artist.trackCount", { count: format.number(tracks.length) })}`
            : ""}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ flexShrink: 0, mb: 2, alignItems: "center" }}
      >
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("library.artist.searchTracks")}
          aria-label={t("library.artist.filterTracks")}
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
        {initialReady && tracks.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("library.artist.noTracks")}
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
              key={bounded.virtuosoKey}
              ref={bounded.virtuosoRef}
              style={{ height: "100%", width: "100%", minHeight: 0 }}
              data={bounded.data}
              initialTopMostItemIndex={bounded.initialTopMostItemIndex}
              rangeChanged={bounded.rangeChanged}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_, track) => String(track.id)}
              itemContent={(_, track) => {
                const { primary: coverId, fallback: fallbackCoverId } =
                  resolveCoverArtIdsForCachedSong(track, albumsById);
                return (
                  <SongItem
                    track={track}
                    coverArtId={coverId}
                    fallbackCoverArtId={fallbackCoverId}
                    api={api}
                    resolveCachedArtwork={resolveCachedArtwork}
                    persistCachedArtwork={persistCachedArtwork}
                    artworkCacheBump={bumpFor(coverId)}
                    artworkCacheKey={
                      coverId && artworkCacheKeyFor ? artworkCacheKeyFor(coverId) : undefined
                    }
                    includeAlbumInSecondary
                    onClick={onPlayTrack ? () => onPlayTrack(track) : undefined}
                    onPlayNext={
                      onPlayNextTrack ? () => onPlayNextTrack(track) : undefined
                    }
                    onAppendToQueue={
                      onAppendTrackToQueue
                        ? () => onAppendTrackToQueue(track)
                        : undefined
                    }
                    onViewAlbum={
                      onViewAlbum && songHasViewableAlbum(track)
                        ? () => onViewAlbum(track)
                        : undefined
                    }
                    offlineScope={{ serverId, libraryId }}
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
