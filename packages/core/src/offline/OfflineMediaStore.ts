import type { LibraryCacheScope } from '../library/cacheScope';

/** Identifies one offline audio blob (variant distinguishes transcoding / format). */
export type OfflineMediaKey = {
  scope: LibraryCacheScope;
  trackId: string;
  variant?: string;
};

export const OFFLINE_MEDIA_DEFAULT_VARIANT = '';

/** Stable string key for deduplication / logging (not used as IndexedDB key path). */
export function offlineMediaKeyId(key: OfflineMediaKey): string {
  const v = key.variant ?? OFFLINE_MEDIA_DEFAULT_VARIANT;
  return `${key.scope.serverKey}\t${key.scope.libraryId}\t${key.trackId}\t${v}`;
}

export type OfflineMediaStatus = 'none' | 'writing' | 'ready' | 'invalid';

export type OfflineMediaStatusDetail = {
  status: OfflineMediaStatus;
  byteLength?: number;
  mimeType?: string;
  updatedAt?: number;
};

/** Result of resolving a ready local file for playback; caller must invoke `revoke` when done (blob URLs). */
export type OfflinePlaybackSource = {
  url: string;
  revoke: () => void;
  /** iOS native: absolute filesystem path; avoids fragile `file://` round-trip through the WebView bridge. */
  localFilePath?: string;
};

/**
 * Platform offline audio persistence. UI and playback use this contract only;
 * IndexedDB, OPFS, SQLite, and native filesystem live in implementations.
 */
export interface OfflineMediaStore {
  readonly backend: string;
  getStatus(key: OfflineMediaKey): Promise<OfflineMediaStatusDetail>;
  /** All keys with `ready` blobs; pass `null` to list across all libraries (for Download Manager). */
  listReadyKeys(scopeFilter: LibraryCacheScope | null): Promise<OfflineMediaKey[]>;
  /** Local playback URL when status is `ready`; otherwise `null`. */
  getReadyPlaybackSource(key: OfflineMediaKey): Promise<OfflinePlaybackSource | null>;
  /**
   * Normalized peak samples in `[0, 1]` for waveform UI. Native iOS implements via AVFoundation;
   * web may omit and rely on Web Audio in the UI layer.
   */
  getWaveformPeaks?(key: OfflineMediaKey, barCount: number): Promise<number[] | null>;
  /**
   * Download from an authenticated HTTP(S) URL (e.g. Subsonic stream URL) into offline storage.
   * Replaces any prior row for the same key on success.
   */
  importFromAuthenticatedUrl(
    key: OfflineMediaKey,
    url: string,
    options?: { signal?: AbortSignal }
  ): Promise<void>;
  delete(key: OfflineMediaKey): Promise<void>;
  deleteScope(scope: LibraryCacheScope): Promise<void>;
  deleteServerAccount(serverKey: string): Promise<void>;
  /** Total bytes for `ready` rows, optionally limited to one library scope. */
  totalReadyBytes(scopeFilter: LibraryCacheScope | null): Promise<number>;
}

/** No-op store for hosts that do not implement offline media yet. */
export function createNoopOfflineMediaStore(): OfflineMediaStore {
  const empty: OfflineMediaStatusDetail = { status: 'none' };
  return {
    backend: 'noop',
    async getStatus() {
      return empty;
    },
    async listReadyKeys() {
      return [];
    },
    async getReadyPlaybackSource() {
      return null;
    },
    async importFromAuthenticatedUrl() {
      throw new Error('OfflineMediaStore is not available on this host');
    },
    async delete() {},
    async deleteScope() {},
    async deleteServerAccount() {},
    async totalReadyBytes() {
      return 0;
    },
  };
}
