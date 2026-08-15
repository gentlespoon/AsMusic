import { useT } from '@asmusic/i18n';
import { Box } from '@mui/material';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '@ui/shared/useLibraryScrollRestoration';
import type { RecommendationsSection as RecommendationsSectionId } from '../../browser/libraryNavigationUrl';
import { RecommendationSection } from './RecommendationSection';
import type {
  RecommendationsEntryLists,
  RecommendationsSongHandlers,
} from './recommendationTypes';

export function RecommendationsHubView({
  lists,
  onOpenSection,
  ...handlers
}: RecommendationsSongHandlers & {
  lists: RecommendationsEntryLists;
  onOpenSection: (section: RecommendationsSectionId) => void;
}) {
  const t = useT();
  const hubScrollRef = useLibraryScrollRestoration('lb:recommendations');

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
        fullEntries={lists.new}
        onViewMore={() => onOpenSection('new')}
      />
      <RecommendationSection
        {...handlers}
        title={t('library.recommendations.recentlyPlayed')}
        fullEntries={lists.recent}
        emptyMessage={t('library.recommendations.emptyRecentlyPlayed')}
        onViewMore={() => onOpenSection('recent')}
      />
      <RecommendationSection
        {...handlers}
        title={t('library.recommendations.mostPlayed')}
        fullEntries={lists.played}
        onViewMore={() => onOpenSection('played')}
      />
    </Box>
  );
}
