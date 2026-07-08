import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { AsmusicNativeWeb } from './asmusicNativePluginWeb';

export type AsmusicNativePluginEvents = {
  playbackState: {
    durationSeconds: number;
    positionSeconds: number;
    isPlaying: boolean;
  };
  playbackEnded: void;
  playbackError: { message: string };
  sleepTimerElapsed: void;
  playbackRemoteSkipNext: void;
  playbackRemoteSkipPrevious: void;
  playbackRemoteFavoriteStar: void;
  playbackRemoteFavoriteUnstar: void;
  offlineMediaReady: { cacheKey: string };
  waveformPeaksReady: { cacheKey: string };
};

export interface AsmusicNativePlugin {
  secureStorageGet(options: { key: string }): Promise<{ value: string | null }>;
  secureStorageSet(options: { key: string; value: string }): Promise<void>;
  secureStorageRemove(options: { key: string }): Promise<void>;
  playbackLoadUrl(options: {
    url: string;
    localFilePath?: string;
    title?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string | null;
    artworkDataBase64?: string | null;
    artworkPlaceholderDataBase64?: string | null;
  }): Promise<void>;
  playbackUpdateArtwork(options: {
    artworkUrl?: string | null;
    artworkDataBase64?: string | null;
    artworkPlaceholderDataBase64?: string | null;
  }): Promise<void>;
  playbackPlay(): Promise<void>;
  playbackPause(): Promise<void>;
  playbackSeek(options: { positionSeconds: number }): Promise<void>;
  playbackSyncRemoteSession(options: {
    hasNext: boolean;
    hasPrevious: boolean;
    favoriteControlsEnabled: boolean;
    starred: boolean;
  }): Promise<void>;
  sleepTimerSet(options: { endsAtEpochMs: number | null }): Promise<void>;
  sleepTimerGet(): Promise<{ endsAtEpochMs: number | null }>;
  libraryCacheReadSongList(options: {
    serverKey: string;
    libraryId: string;
  }): Promise<{ songsJson: string }>;
  libraryCacheReadMeta(options: {
    serverKey: string;
    libraryId: string;
  }): Promise<{ lastSyncAt: number | null; songCount: number | null }>;
  libraryCacheReadCachedAlbumCount(options: {
    serverKey: string;
    libraryId: string;
  }): Promise<{ albumCount: number }>;
  libraryCachePurgeArtistAndAlbumCaches(options: { serverKey: string; libraryId: string }): Promise<void>;
  libraryCacheReplaceSongList(options: {
    serverKey: string;
    libraryId: string;
    songsJson: string;
    artistsJson: string;
    albumsJson: string;
  }): Promise<void>;
  libraryCachePatchSong(options: {
    serverKey: string;
    libraryId: string;
    songId: string;
    songJson: string;
  }): Promise<void>;
  libraryCacheReadPlaylistSummaries(options: {
    serverKey: string;
  }): Promise<{ playlistsJson: string }>;
  libraryCacheReplacePlaylistSummaries(options: {
    serverKey: string;
    playlistsJson: string;
  }): Promise<void>;
  libraryCacheReadPlaylistEntryTrackIds(options: {
    serverKey: string;
    playlistId: string;
  }): Promise<{ trackIdsJson: string }>;
  libraryCacheReplacePlaylistEntryTrackIds(options: {
    serverKey: string;
    playlistId: string;
    trackIdsJson: string;
  }): Promise<void>;
  libraryCachePurgePlaylistEntryTrackIdsNotIn(options: {
    serverKey: string;
    playlistIdsJson: string;
  }): Promise<void>;
  libraryCacheDeleteScope(options: { serverKey: string; libraryId: string }): Promise<void>;
  /** Remove all library cache rows for this account `serverKey` (all music folders). */
  libraryCachePurgeServerAccount(options: { serverKey: string }): Promise<void>;
  libraryCacheClearArtwork(options: { serverKey: string; libraryId: string }): Promise<void>;
  libraryCachePurgeAllArtwork(): Promise<void>;
  libraryCachePutArtworkBatch(options: {
    serverKey: string;
    libraryId: string;
    entriesJson: string;
  }): Promise<void>;
  libraryCachePutArtworkBlob(options: {
    serverKey: string;
    libraryId: string;
    coverArtId: string;
    mimeType: string;
    base64: string;
  }): Promise<void>;
  libraryCacheReadArtworkBlob(options: {
    serverKey: string;
    libraryId: string;
    coverArtId: string;
  }): Promise<{ mimeType: string | null; base64: string | null }>;
  libraryCacheMaterializeArtworkFile(options: {
    serverKey: string;
    libraryId: string;
    coverArtId: string;
  }): Promise<{ localFilePath: string | null; mimeType: string | null }>;
  offlineMediaImportFromUrl(options: {
    serverKey: string;
    libraryId: string;
    trackId: string;
    variant?: string;
    url: string;
  }): Promise<void>;
  offlineMediaGetStatus(options: {
    serverKey: string;
    libraryId: string;
    trackId: string;
    variant?: string;
  }): Promise<{ status: string; byteLength?: number; mimeType?: string; updatedAt?: number }>;
  offlineMediaGetPlaybackUrl(options: {
    serverKey: string;
    libraryId: string;
    trackId: string;
    variant?: string;
  }): Promise<{ url: string | null; localFilePath: string | null }>;
  offlineMediaWaveformPeaks(options: {
    serverKey: string;
    libraryId: string;
    trackId: string;
    variant?: string;
    barCount: number;
  }): Promise<{ peaks: number[] }>;
  offlineMediaListReady(options: {
    serverKey?: string;
    libraryId?: string;
  }): Promise<{ rowsJson: string }>;
  offlineMediaDeleteOne(options: {
    serverKey: string;
    libraryId: string;
    trackId: string;
    variant?: string;
  }): Promise<void>;
  offlineMediaDeleteScope(options: { serverKey: string; libraryId: string }): Promise<void>;
  offlineMediaPurgeServerKey(options: { serverKey: string }): Promise<void>;
  offlineMediaTotalBytes(options: { serverKey?: string; libraryId?: string }): Promise<{ totalBytes: number }>;
  localPlaylistListSummaries(): Promise<{ summariesJson: string }>;
  localPlaylistReadEntries(options: { playlistId: string }): Promise<{ entriesJson: string }>;
  localPlaylistCreate(options: {
    playlistId: string;
    name: string;
    createdAt: number;
  }): Promise<{ summaryJson: string }>;
  localPlaylistRename(options: { playlistId: string; name: string; updatedAt: number }): Promise<void>;
  localPlaylistDelete(options: { playlistId: string }): Promise<void>;
  localPlaylistReplaceEntries(options: {
    playlistId: string;
    entriesJson: string;
    updatedAt: number;
  }): Promise<void>;
  localPlaylistAppendEntry(options: {
    playlistId: string;
    entryJson: string;
    updatedAt: number;
  }): Promise<void>;
  playerDebugLogGet(): Promise<{ log: string }>;
  playerDebugLogClear(): Promise<void>;
  playerDebugLogAppend(options: { message: string }): Promise<void>;
  addListener<E extends keyof AsmusicNativePluginEvents>(
    event: E,
    listener: (payload: AsmusicNativePluginEvents[E]) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const AsmusicNative = registerPlugin<AsmusicNativePlugin>('AsmusicNative', {
  web: () => new AsmusicNativeWeb(),
});
