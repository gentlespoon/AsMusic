import { useMemo } from 'react';
import { useT } from '@asmusic/i18n';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Shuffle from '@mui/icons-material/Shuffle';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  isChildStarred,
  resolveCoverArtIdsForCachedSong,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type SubsonicAPI,
} from '@asmusic/core';
import type { AlbumID3 } from 'subsonic-api';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { SongItem } from '@ui/shared/songItem';
import type { PersistCachedArtwork } from '@ui/shared/libraryArtworkCacheAccess';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '@ui/shared/useLibraryScrollRestoration';
import {
  LibraryDetailTitle,
  libraryDetailHeaderStackSx,
} from '../shared/libraryTypography';
import type { RecommendationsSection } from '../browser/libraryNavigationUrl';
import {
  songHasViewableAlbum,
  songHasViewableArtist,
} from '../browser/useSongLibraryNavigation';
import {
  RECOMMENDATIONS_PREVIEW_LIMIT,
  selectMostPlayedSongEntries,
  selectNewestSongEntries,
} from './recommendationSelectors';
import { SongListView, type SongListEntry } from './SongListView';

type SharedSongHandlers = {
  songEntries: SongListEntry[];
  albumsByScope: ReadonlyMap<string, AlbumID3[]>;
  apiForServer: (serverId: string) => SubsonicAPI | null;
  initialReady: boolean;
  resolveCachedArtwork: (
    coverArtId: string,
    scope: LibraryCacheScope
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtworkForScope: (scope: LibraryCacheScope) => PersistCachedArtwork;
  artworkVersionKey: (coverArtId: string, scope: LibraryCacheScope) => string;
  getArtworkCacheBump: (coverArtId: string, scope: LibraryCacheScope) => number;
  onPlaySong?: (entry: SongListEntry) => void;
  onPlayNextSong?: (entry: SongListEntry) => void;
  onAppendSongToQueue?: (entry: SongListEntry) => void;
  onViewArtist?: (entry: SongListEntry) => void;
  onViewAlbum?: (entry: SongListEntry) => void;
  onAppendAllToQueue?: (entries: SongListEntry[]) => void;
  onShufflePlayAll?: (entries: SongListEntry[]) => void;
  onReplaceQueueAndPlayAll?: (entries: SongListEntry[]) => void;
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
};

function RecommendationSection({
  title,
  fullEntries,
  albumsByScope,
  apiForServer,
  initialReady,
  resolveCachedArtwork,
  persistCachedArtworkForScope,
  artworkVersionKey,
  getArtworkCacheBump,
  onPlaySong,
  onPlayNextSong,
  onAppendSongToQueue,
  onViewArtist,
  onViewAlbum,
  onShufflePlayAll,
  onReplaceQueueAndPlayAll,
  onViewMore,
  setTrackStarred,
}: SharedSongHandlers & {
  title: string;
  fullEntries: SongListEntry[];
  onViewMore: () => void;
}) {
  const t = useT();
  const preview = fullEntries.slice(0, RECOMMENDATIONS_PREVIEW_LIMIT);
  const canPlay = initialReady && fullEntries.length > 0;
  const showViewMore = fullEntries.length > RECOMMENDATIONS_PREVIEW_LIMIT;

  return (
    <Box component="section" sx={{ mb: 3 }}>
      <Stack sx={libraryDetailHeaderStackSx}>
        <LibraryDetailTitle sx={{ typography: 'subtitle1' }}>{title}</LibraryDetailTitle>
        <Tooltip title={t('player.action.playAll')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('player.action.playAllSongs')}
              disabled={!canPlay || !onReplaceQueueAndPlayAll}
              onClick={() => onReplaceQueueAndPlayAll?.(fullEntries)}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('player.action.shuffleAll')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('player.action.shuffleAllSongs')}
              disabled={!canPlay || !onShufflePlayAll}
              onClick={() => onShufflePlayAll?.(fullEntries)}
            >
              <Shuffle fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {!initialReady && (
        <Typography variant="body2" color="text.secondary">
          {t('library.cache.loading')}
        </Typography>
      )}
      {initialReady && fullEntries.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('library.recommendations.empty')}
        </Typography>
      )}
      {initialReady && preview.length > 0 && (
        <List disablePadding>
          {preview.map((entry) => {
            const scopeKey = `${entry.artworkScope.serverKey}|${entry.artworkScope.libraryId}`;
            const scopeAlbums = albumsByScope.get(scopeKey) ?? [];
            const { primary: coverId, fallback: fallbackCoverId } =
              resolveCoverArtIdsForCachedSong(entry.song, scopeAlbums);
            const artworkKey = coverId ? artworkVersionKey(coverId, entry.artworkScope) : undefined;
            const api = apiForServer(entry.serverId);
            const starred = isChildStarred(entry.song);
            return (
              <SongItem
                key={entry.rowKey}
                track={entry.song}
                coverArtId={coverId}
                fallbackCoverArtId={fallbackCoverId}
                api={api}
                resolveCachedArtwork={(id) => resolveCachedArtwork(id, entry.artworkScope)}
                persistCachedArtwork={persistCachedArtworkForScope(entry.artworkScope)}
                artworkCacheBump={
                  coverId ? getArtworkCacheBump(coverId, entry.artworkScope) : 0
                }
                artworkCacheKey={artworkKey}
                includeAlbumInSecondary
                onClick={onPlaySong ? () => onPlaySong(entry) : undefined}
                onPlayNext={onPlayNextSong ? () => onPlayNextSong(entry) : undefined}
                onAppendToQueue={
                  onAppendSongToQueue ? () => onAppendSongToQueue(entry) : undefined
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
                offlineScope={{
                  serverId: entry.serverId,
                  libraryId: entry.artworkScope.libraryId,
                }}
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
          })}
          {showViewMore && (
            <ListItemButton divider onClick={onViewMore} sx={{ py: 0.75, px: 0 }}>
              <ListItemText
                primary={t('library.recommendations.viewMore')}
                slotProps={{
                  primary: { variant: 'body2', color: 'primary', sx: { fontWeight: 600 } },
                }}
              />
            </ListItemButton>
          )}
        </List>
      )}
    </Box>
  );
}

/**
 * Recommendations hub (New Songs + Most Played previews) or nested full list (`rec=new|played`).
 * Offline-first from the library song cache — no live Subsonic catalog calls.
 */
export function RecommendationsListView({
  section,
  onOpenSection,
  onBack,
  ...handlers
}: SharedSongHandlers & {
  section: RecommendationsSection | null;
  onOpenSection: (section: RecommendationsSection) => void;
  onBack: () => void;
}) {
  const t = useT();
  const { songEntries, initialReady } = handlers;

  const newestFull = useMemo(() => selectNewestSongEntries(songEntries), [songEntries]);
  const mostPlayedFull = useMemo(() => selectMostPlayedSongEntries(songEntries), [songEntries]);

  const hubScrollRef = useLibraryScrollRestoration(
    section == null ? 'lb:recommendations' : undefined
  );

  if (section != null) {
    const entries = section === 'new' ? newestFull : mostPlayedFull;
    const title =
      section === 'new'
        ? t('library.recommendations.newSongs')
        : t('library.recommendations.mostPlayed');
    const scrollKey =
      section === 'new' ? 'lb:recommendations:new' : 'lb:recommendations:played';

    return (
      <Box
        role="tabpanel"
        id="library-panel-recommendations"
        aria-labelledby="library-tab-recommendations"
        sx={{
          ...libraryFlexFillSx,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Stack sx={libraryDetailHeaderStackSx}>
          <PageCloseButton edge="start" onClick={onBack} sx={{ alignSelf: 'flex-start' }} />
          <LibraryDetailTitle>{title}</LibraryDetailTitle>
        </Stack>
        <SongListView
          entries={entries}
          albumsByScope={handlers.albumsByScope}
          apiForServer={handlers.apiForServer}
          initialReady={initialReady}
          resolveCachedArtwork={handlers.resolveCachedArtwork}
          persistCachedArtworkForScope={handlers.persistCachedArtworkForScope}
          artworkVersionKey={handlers.artworkVersionKey}
          getArtworkCacheBump={handlers.getArtworkCacheBump}
          scrollRestorationKey={scrollKey}
          panelId={`library-panel-recommendations-${section}`}
          ariaLabelledBy="library-tab-recommendations"
          searchPlaceholder={
            section === 'new'
              ? t('library.recommendations.search')
              : t('library.recommendations.searchMostPlayed')
          }
          emptyListMessage={t('library.recommendations.empty')}
          noSearchMatchMessage={t('library.recommendations.noMatch')}
          onPlaySong={handlers.onPlaySong}
          onPlayNextSong={handlers.onPlayNextSong}
          onAppendSongToQueue={handlers.onAppendSongToQueue}
          onViewArtist={handlers.onViewArtist}
          onViewAlbum={handlers.onViewAlbum}
          onAppendAllToQueue={handlers.onAppendAllToQueue}
          onShufflePlayAll={handlers.onShufflePlayAll}
          setTrackStarred={handlers.setTrackStarred}
        />
      </Box>
    );
  }

  return (
    <Box
      role="tabpanel"
      id="library-panel-recommendations"
      aria-labelledby="library-tab-recommendations"
      ref={hubScrollRef}
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        minHeight: 0,
      }}
    >
      <RecommendationSection
        {...handlers}
        title={t('library.recommendations.newSongs')}
        fullEntries={newestFull}
        onViewMore={() => onOpenSection('new')}
      />
      <RecommendationSection
        {...handlers}
        title={t('library.recommendations.mostPlayed')}
        fullEntries={mostPlayedFull}
        onViewMore={() => onOpenSection('played')}
      />
    </Box>
  );
}
