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
import { isChildStarred, resolveCoverArtIdsForCachedSong } from '@asmusic/core';
import { SongItem } from '@ui/shared/songItem';
import {
  LibraryDetailTitle,
  libraryDetailHeaderStackSx,
} from '../../shared/libraryTypography';
import {
  songHasViewableAlbum,
  songHasViewableArtist,
} from '../../browser/useSongLibraryNavigation';
import { RECOMMENDATIONS_PREVIEW_LIMIT } from './recommendationSelectors';
import type { RecommendationsSongHandlers } from './recommendationTypes';
import type { SongListEntry } from '../SongListView';

export function RecommendationSection({
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
  emptyMessage,
}: RecommendationsSongHandlers & {
  title: string;
  fullEntries: SongListEntry[];
  onViewMore: () => void;
  emptyMessage?: string;
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
          {emptyMessage ?? t('library.recommendations.empty')}
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
