import { useMemo } from 'react';
import type { RecommendationsSection } from '../../browser/libraryNavigationUrl';
import {
  selectMostPlayedSongEntries,
  selectNewestSongEntries,
  selectRecentlyPlayedSongEntries,
} from './recommendationSelectors';
import type { RecommendationsSongHandlers } from './recommendationTypes';
import { RecommendationsHubView } from './RecommendationsHubView';
import { RecommendationsNestedListView } from './RecommendationsNestedListView';

/**
 * Recommendations hub (New Songs + Recently Played + Most Played previews) or nested full list
 * (`rec=new|recent|played`). Offline-first from the library song cache — no live Subsonic catalog calls.
 */
export function RecommendationsListView({
  section,
  onOpenSection,
  onBack,
  ...handlers
}: RecommendationsSongHandlers & {
  section: RecommendationsSection | null;
  onOpenSection: (section: RecommendationsSection) => void;
  onBack: () => void;
}) {
  const { songEntries } = handlers;

  const lists = useMemo(
    () => ({
      new: selectNewestSongEntries(songEntries),
      recent: selectRecentlyPlayedSongEntries(songEntries),
      played: selectMostPlayedSongEntries(songEntries),
    }),
    [songEntries]
  );

  if (section != null) {
    return (
      <RecommendationsNestedListView
        {...handlers}
        section={section}
        entries={lists[section]}
        onBack={onBack}
      />
    );
  }

  return (
    <RecommendationsHubView {...handlers} lists={lists} onOpenSection={onOpenSection} />
  );
}
