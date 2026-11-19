import type {
  LibraryArtworkCacheRow,
  LibraryCacheScope,
  SubsonicAPI,
} from '@asmusic/core';
import type { AlbumID3 } from 'subsonic-api';
import type { PersistCachedArtwork } from '@ui/shared/libraryArtworkCacheAccess';
import type { SongListEntry } from '../SongListView';

export type RecommendationsSongHandlers = {
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

export type RecommendationsEntryLists = {
  new: SongListEntry[];
  recent: SongListEntry[];
  played: SongListEntry[];
};
