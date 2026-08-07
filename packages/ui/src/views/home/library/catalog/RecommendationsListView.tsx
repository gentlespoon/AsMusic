import { useMemo } from 'react';
import { useT } from '@asmusic/i18n';
import { albumCreatedMs, type LibraryArtworkCacheRow, type LibraryCacheScope, type SubsonicAPI } from '@asmusic/core';
import type { AlbumID3 } from 'subsonic-api';
import type { PersistCachedArtwork } from '@ui/shared/libraryArtworkCacheAccess';
import { SongListView, type SongListEntry } from './SongListView';

const NEWEST_TRACK_LIMIT = 50;

/**
 * Recently added tracks from the local library cache (newest `created` first, capped).
 * No live Subsonic calls — same offline-first model as Songs / Favorites.
 */
export function RecommendationsListView({
  songEntries,
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
  onAppendAllToQueue,
  onShufflePlayAll,
  setTrackStarred,
}: {
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
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
}) {
  const t = useT();

  const entries = useMemo(() => {
    return [...songEntries]
      .sort((a, b) => albumCreatedMs(b.song) - albumCreatedMs(a.song))
      .slice(0, NEWEST_TRACK_LIMIT);
  }, [songEntries]);

  return (
    <SongListView
      entries={entries}
      albumsByScope={albumsByScope}
      apiForServer={apiForServer}
      initialReady={initialReady}
      resolveCachedArtwork={resolveCachedArtwork}
      persistCachedArtworkForScope={persistCachedArtworkForScope}
      artworkVersionKey={artworkVersionKey}
      getArtworkCacheBump={getArtworkCacheBump}
      scrollRestorationKey="lb:recommendations"
      panelId="library-panel-recommendations"
      ariaLabelledBy="library-tab-recommendations"
      searchPlaceholder={t('library.recommendations.search')}
      emptyListMessage={t('library.recommendations.empty')}
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
  );
}
