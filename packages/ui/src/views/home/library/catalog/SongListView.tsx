import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import Shuffle from "@mui/icons-material/Shuffle";
import { useT } from "@asmusic/i18n";
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import {
  resolveCoverArtIdsForCachedSong,
  isChildStarred,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type SubsonicAPI,
} from "@asmusic/core";
import type { AlbumID3, Child } from "subsonic-api";
import { SongItem } from "@ui/shared/songItem";
import type { PersistCachedArtwork } from "@ui/shared/libraryArtworkCacheAccess";
import { songMatchesQuery } from "@ui/shared/songSearch";
import { LibraryVirtuosoFill, libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { useLibraryScrollRestoration } from "@ui/shared/useLibraryScrollRestoration";
import { useLibraryVirtuosoScroller } from "@ui/shared/useLibraryVirtuosoScroller";
import { VirtuosoMuiList } from "@ui/shared/virtuosoMuiList";
import {
  songHasViewableAlbum,
  songHasViewableArtist,
} from "../browser/useSongLibraryNavigation";

export type SongListEntry = {
  song: Child;
  rowKey: string;
  serverId: string;
  artworkScope: LibraryCacheScope;
};

export function SongListView({
  entries,
  albumsByScope,
  apiForServer,
  initialReady,
  resolveCachedArtwork,
  persistCachedArtworkForScope,
  artworkVersionKey,
  getArtworkCacheBump,
  includeAlbumInSecondary = true,
  onPlaySong,
  onPlayNextSong,
  onAppendSongToQueue,
  onViewArtist,
  onViewAlbum,
  onAppendAllToQueue,
  onShufflePlayAll,
  scrollRestorationKey = "lb:songs",
  panelId = "library-panel-2",
  ariaLabelledBy = "library-tab-2",
  searchPlaceholder,
  emptyListMessage,
  noSearchMatchMessage,
  setTrackStarred,
}: {
  entries: SongListEntry[];
  albumsByScope: ReadonlyMap<string, AlbumID3[]>;
  apiForServer: (serverId: string) => SubsonicAPI | null;
  initialReady: boolean;
  resolveCachedArtwork: (
    coverArtId: string,
    scope: LibraryCacheScope,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtworkForScope: (scope: LibraryCacheScope) => PersistCachedArtwork;
  /** Stable key into artwork cache bump for this cover id (default: cover id only). */
  artworkVersionKey?: (coverArtId: string, scope: LibraryCacheScope) => string;
  getArtworkCacheBump: (coverArtId: string, scope: LibraryCacheScope) => number;
  includeAlbumInSecondary?: boolean;
  /** Primary row action: play this track next (insert after current + start it), without replacing the queue. */
  onPlaySong?: (entry: SongListEntry) => void;
  onPlayNextSong?: (entry: SongListEntry) => void;
  onAppendSongToQueue?: (entry: SongListEntry) => void;
  onViewArtist?: (entry: SongListEntry) => void;
  onViewAlbum?: (entry: SongListEntry) => void;
  /** Append every song currently shown (respects the search filter). */
  onAppendAllToQueue?: (entries: SongListEntry[]) => void;
  /** Replace the queue with a shuffled copy of the songs currently shown, then play. */
  onShufflePlayAll?: (entries: SongListEntry[]) => void;
  scrollRestorationKey?: string;
  panelId?: string;
  ariaLabelledBy?: string;
  searchPlaceholder?: string;
  emptyListMessage?: string;
  noSearchMatchMessage?: string;
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
}) {
  const t = useT();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("library.songs.search");
  const resolvedNoSearchMatchMessage = noSearchMatchMessage ?? t("library.songs.noMatch");
  const resolvedEmptyListMessage = emptyListMessage ?? t("library.songs.empty");
  const [search, setSearch] = useState("");

  const filteredEntries = useMemo(
    () => entries.filter((e) => songMatchesQuery(e.song, search)),
    [entries, search],
  );

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration(scrollRestorationKey);
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: "start" });
  }, [search]);

  const versionFor = (
    coverArtId: string | undefined,
    scope: LibraryCacheScope,
  ) => {
    if (!coverArtId) return 0;
    return getArtworkCacheBump(coverArtId, scope);
  };

  return (
    <Box
      role="tabpanel"
      id={panelId}
      aria-labelledby={ariaLabelledBy}
      sx={{
        ...libraryFlexFillSx,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ flexShrink: 0, mb: 2, alignItems: "center" }}
      >
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={resolvedSearchPlaceholder}
          aria-label={resolvedSearchPlaceholder}
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
                disabled={!initialReady || filteredEntries.length === 0}
                onClick={() => onAppendAllToQueue(filteredEntries)}
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
                disabled={!initialReady || filteredEntries.length === 0}
                onClick={() => onShufflePlayAll(filteredEntries)}
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
        {initialReady && entries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {resolvedEmptyListMessage}
          </Typography>
        )}
        {initialReady &&
          entries.length > 0 &&
          filteredEntries.length === 0 &&
          queryTrimmed.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {resolvedNoSearchMatchMessage}
            </Typography>
          )}
        {initialReady && filteredEntries.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: "100%", width: "100%", minHeight: 0 }}
              data={filteredEntries}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_, entry) => entry.rowKey}
              itemContent={(_, entry) => {
                const scopeKey = `${entry.artworkScope.serverKey}|${entry.artworkScope.libraryId}`;
                const scopeAlbums = albumsByScope.get(scopeKey) ?? [];
                const { primary: coverId, fallback: fallbackCoverId } =
                  resolveCoverArtIdsForCachedSong(entry.song, scopeAlbums);
                const artworkKey = coverId
                  ? artworkVersionKey
                    ? artworkVersionKey(coverId, entry.artworkScope)
                    : coverId
                  : undefined;
                const api = apiForServer(entry.serverId);
                const starred = isChildStarred(entry.song);
                return (
                  <SongItem
                    track={entry.song}
                    coverArtId={coverId}
                    fallbackCoverArtId={fallbackCoverId}
                    api={api}
                    resolveCachedArtwork={(id) =>
                      resolveCachedArtwork(id, entry.artworkScope)
                    }
                    persistCachedArtwork={persistCachedArtworkForScope(entry.artworkScope)}
                    artworkCacheBump={versionFor(coverId, entry.artworkScope)}
                    artworkCacheKey={artworkKey}
                    includeAlbumInSecondary={includeAlbumInSecondary}
                    onClick={onPlaySong ? () => onPlaySong(entry) : undefined}
                    onPlayNext={
                      onPlayNextSong ? () => onPlayNextSong(entry) : undefined
                    }
                    onAppendToQueue={
                      onAppendSongToQueue
                        ? () => onAppendSongToQueue(entry)
                        : undefined
                    }
                    onViewArtist={
                      onViewArtist && songHasViewableArtist(entry.song)
                        ? () => onViewArtist(entry)
                        : undefined
                    }
                    onViewAlbum={
                      onViewAlbum && songHasViewableAlbum(entry.song)
                        ? () => onViewAlbum(entry)
                        : undefined
                    }
                    isStarred={setTrackStarred ? starred : undefined}
                    onToggleStar={
                      setTrackStarred
                        ? () =>
                            setTrackStarred({
                              serverId: entry.serverId,
                              libraryId: entry.artworkScope.libraryId,
                              trackId: String(entry.song.id),
                              starred: !starred,
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
