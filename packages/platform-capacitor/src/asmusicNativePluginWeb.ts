import { WebPlugin } from '@capacitor/core';
import type { AsmusicNativePlugin } from './asmusicNativePlugin';

/** No-op web implementation; native iOS provides the real bridge. */
export class AsmusicNativeWeb extends WebPlugin implements AsmusicNativePlugin {
  async secureStorageGet(): Promise<{ value: string | null }> {
    return { value: null };
  }

  async secureStorageSet(): Promise<void> {}

  async secureStorageRemove(): Promise<void> {}

  async playbackLoadUrl(): Promise<void> {}

  async playbackUpdateArtwork(): Promise<void> {}

  async playbackPlay(): Promise<void> {}

  async playbackPause(): Promise<void> {}

  async playbackSeek(): Promise<void> {}

  async playbackSyncRemoteSession(): Promise<void> {}

  async sleepTimerSet(): Promise<void> {}

  async sleepTimerGet(): Promise<{ endsAtEpochMs: number | null }> {
    return { endsAtEpochMs: null };
  }

  async libraryCacheReadSongList(): Promise<{ songsJson: string }> {
    throwNativeOnly('libraryCacheReadSongList');
  }

  async libraryCacheReadMeta(): Promise<{ lastSyncAt: number | null; songCount: number | null }> {
    throwNativeOnly('libraryCacheReadMeta');
  }

  async libraryCacheReadCachedAlbumCount(): Promise<{ albumCount: number }> {
    throwNativeOnly('libraryCacheReadCachedAlbumCount');
  }

  async libraryCachePurgeArtistAndAlbumCaches(): Promise<void> {
    throwNativeOnly('libraryCachePurgeArtistAndAlbumCaches');
  }

  async libraryCacheReplaceSongList(): Promise<void> {
    throwNativeOnly('libraryCacheReplaceSongList');
  }

  async libraryCachePatchSong(): Promise<void> {
    throwNativeOnly('libraryCachePatchSong');
  }

  async libraryCacheReadPlaylistSummaries(): Promise<{ playlistsJson: string }> {
    throwNativeOnly('libraryCacheReadPlaylistSummaries');
  }

  async libraryCacheReplacePlaylistSummaries(): Promise<void> {
    throwNativeOnly('libraryCacheReplacePlaylistSummaries');
  }

  async libraryCacheReadPlaylistEntryTrackIds(): Promise<{ trackIdsJson: string }> {
    throwNativeOnly('libraryCacheReadPlaylistEntryTrackIds');
  }

  async libraryCacheReplacePlaylistEntryTrackIds(): Promise<void> {
    throwNativeOnly('libraryCacheReplacePlaylistEntryTrackIds');
  }

  async libraryCachePurgePlaylistEntryTrackIdsNotIn(): Promise<void> {
    throwNativeOnly('libraryCachePurgePlaylistEntryTrackIdsNotIn');
  }

  async libraryCacheDeleteScope(): Promise<void> {
    throwNativeOnly('libraryCacheDeleteScope');
  }

  async libraryCachePurgeServerAccount(): Promise<void> {
    throwNativeOnly('libraryCachePurgeServerAccount');
  }

  async libraryCacheClearArtwork(): Promise<void> {
    throwNativeOnly('libraryCacheClearArtwork');
  }

  async libraryCachePurgeAllArtwork(): Promise<void> {
    throwNativeOnly('libraryCachePurgeAllArtwork');
  }

  async libraryCachePutArtworkBatch(): Promise<void> {
    throwNativeOnly('libraryCachePutArtworkBatch');
  }

  async libraryCachePutArtworkBlob(): Promise<void> {
    throwNativeOnly('libraryCachePutArtworkBlob');
  }

  async libraryCacheReadArtworkBlob(): Promise<{ mimeType: string | null; base64: string | null }> {
    return { mimeType: null, base64: null };
  }

  async libraryCacheMaterializeArtworkFile(): Promise<{
    localFilePath: string | null;
    mimeType: string | null;
  }> {
    return { localFilePath: null, mimeType: null };
  }

  async offlineMediaImportFromUrl(): Promise<void> {
    throwNativeOnly('offlineMediaImportFromUrl');
  }

  async offlineMediaGetStatus(): Promise<{
    status: string;
    byteLength?: number;
    mimeType?: string;
    updatedAt?: number;
  }> {
    throwNativeOnly('offlineMediaGetStatus');
  }

  async offlineMediaGetPlaybackUrl(): Promise<{ url: string | null; localFilePath: string | null }> {
    throwNativeOnly('offlineMediaGetPlaybackUrl');
  }

  async offlineMediaWaveformPeaks(): Promise<{ peaks: number[] }> {
    throwNativeOnly('offlineMediaWaveformPeaks');
  }

  async offlineMediaListReady(): Promise<{ rowsJson: string }> {
    throwNativeOnly('offlineMediaListReady');
  }

  async offlineMediaDeleteOne(): Promise<void> {
    throwNativeOnly('offlineMediaDeleteOne');
  }

  async offlineMediaDeleteScope(): Promise<void> {
    throwNativeOnly('offlineMediaDeleteScope');
  }

  async offlineMediaPurgeServerKey(): Promise<void> {
    throwNativeOnly('offlineMediaPurgeServerKey');
  }

  async offlineMediaTotalBytes(): Promise<{ totalBytes: number }> {
    throwNativeOnly('offlineMediaTotalBytes');
  }

  async localPlaylistListSummaries(): Promise<{ summariesJson: string }> {
    throwNativeOnly('localPlaylistListSummaries');
  }

  async localPlaylistReadEntries(): Promise<{ entriesJson: string }> {
    throwNativeOnly('localPlaylistReadEntries');
  }

  async localPlaylistCreate(): Promise<{ summaryJson: string }> {
    throwNativeOnly('localPlaylistCreate');
  }

  async localPlaylistRename(): Promise<void> {
    throwNativeOnly('localPlaylistRename');
  }

  async localPlaylistDelete(): Promise<void> {
    throwNativeOnly('localPlaylistDelete');
  }

  async localPlaylistReplaceEntries(): Promise<void> {
    throwNativeOnly('localPlaylistReplaceEntries');
  }

  async localPlaylistAppendEntry(): Promise<void> {
    throwNativeOnly('localPlaylistAppendEntry');
  }

  async playerDebugLogGet(): Promise<{ log: string }> {
    return { log: '' };
  }

  async playerDebugLogClear(): Promise<void> {}

  async playerDebugLogAppend(): Promise<void> {}
}

function throwNativeOnly(method: string): never {
  throw new Error(`AsmusicNative.${method} is only available on the iOS native shell`);
}
