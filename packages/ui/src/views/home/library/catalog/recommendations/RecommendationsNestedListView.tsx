import { useT } from '@asmusic/i18n';
import { Box, Stack } from '@mui/material';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import {
  LibraryDetailTitle,
  libraryDetailHeaderStackSx,
} from '../../shared/libraryTypography';
import type { RecommendationsSection } from '../../browser/libraryNavigationUrl';
import { SongListView, type SongListEntry } from '../SongListView';
import type { RecommendationsSongHandlers } from './recommendationTypes';

export function RecommendationsNestedListView({
  section,
  entries,
  onBack,
  initialReady,
  albumsByScope,
  apiForServer,
  resolveCachedArtwork,
  persistCachedArtworkForScope,
  artworkVersionKey,
  getArtworkCacheBump,
  onPlaySong,
  onPlayNextSong,
  onAppendSongToQueue,
  onViewArtist,
  onViewAlbum,
  onAppendAllToQueue,
  onShufflePlayAll,
  setTrackStarred,
}: RecommendationsSongHandlers & {
  section: RecommendationsSection;
  entries: SongListEntry[];
  onBack: () => void;
}) {
  const t = useT();

  const title =
    section === 'new'
      ? t('library.recommendations.newSongs')
      : section === 'recent'
        ? t('library.recommendations.recentlyPlayed')
        : t('library.recommendations.mostPlayed');
  const scrollKey =
    section === 'new'
      ? 'lb:recommendations:new'
      : section === 'recent'
        ? 'lb:recommendations:recent'
        : 'lb:recommendations:played';
  const searchPlaceholder =
    section === 'new'
      ? t('library.recommendations.search')
      : section === 'recent'
        ? t('library.recommendations.searchRecentlyPlayed')
        : t('library.recommendations.searchMostPlayed');
  const emptyListMessage =
    section === 'recent'
      ? t('library.recommendations.emptyRecentlyPlayed')
      : t('library.recommendations.empty');

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
        albumsByScope={albumsByScope}
        apiForServer={apiForServer}
        initialReady={initialReady}
        resolveCachedArtwork={resolveCachedArtwork}
        persistCachedArtworkForScope={persistCachedArtworkForScope}
        artworkVersionKey={artworkVersionKey}
        getArtworkCacheBump={getArtworkCacheBump}
        scrollRestorationKey={scrollKey}
        panelId={`library-panel-recommendations-${section}`}
        ariaLabelledBy="library-tab-recommendations"
        searchPlaceholder={searchPlaceholder}
        emptyListMessage={emptyListMessage}
        noSearchMatchMessage={t('library.recommendations.noMatch')}
        onPlaySong={onPlaySong}
        onPlayNextSong={onPlayNextSong}
        onAppendSongToQueue={onAppendSongToQueue}
        onViewArtist={onViewArtist}
        onViewAlbum={onViewAlbum}
        onAppendAllToQueue={onAppendAllToQueue}
        onShufflePlayAll={onShufflePlayAll}
        setTrackStarred={setTrackStarred}
      />
    </Box>
  );
}
