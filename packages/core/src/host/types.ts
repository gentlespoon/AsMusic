/**
 * PlatformHost — single extension point for native capabilities (playback, secure storage, library cache).
 * Implementations: browser (dev), iOS Capacitor today; Android / desktop adapters later.
 */

import type { LibraryCacheStorage } from '../library/storage/LibraryCacheStorage';
import type { OfflineMediaStore } from '../offline/OfflineMediaStore';

export type PlatformKind = 'browser' | 'ios-capacitor';

export type PlaybackStatePayload = {
  durationSeconds: number;
  positionSeconds: number;
  isPlaying: boolean;
};

/** iOS lock screen / Control Center remote command availability + favorite UI sync. */
export type PlaybackRemoteSessionPayload = {
  hasNext: boolean;
  hasPrevious: boolean;
  favoriteControlsEnabled: boolean;
  starred: boolean;
};

export type PlaybackHost = {
  loadUrl(
    url: string,
    meta?: {
      title?: string;
      artist?: string;
      album?: string;
      artworkUrl?: string | null;
      /** iOS native: load from this path instead of parsing `url` (offline downloads). */
      localFilePath?: string;
    }
  ): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  /** Coarse progress from the transport (native throttles; browser uses timeupdate). */
  onPlaybackState(cb: (s: PlaybackStatePayload) => void): () => void;
  onPlaybackEnded(cb: () => void): () => void;
  onPlaybackError(cb: (e: { message: string }) => void): () => void;
  /** Native-only: sync MPRemoteCommandCenter skip/favorite state from the JS queue. */
  syncRemoteSession?(payload: PlaybackRemoteSessionPayload): Promise<void>;
  onRemoteSkipNext?(cb: () => void): () => void;
  onRemoteSkipPrevious?(cb: () => void): () => void;
  onRemoteFavoriteStar?(cb: () => void): () => void;
  onRemoteFavoriteUnstar?(cb: () => void): () => void;
};

export type SecureStorageHost = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** Wall-clock sleep timer; implementations may use native timers on mobile. */
export type SleepTimerHost = {
  setDeadline(endsAtEpochMs: number | null): Promise<void>;
  getDeadline(): Promise<number | null>;
  onElapsed(cb: () => void): () => void;
};

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';

export type HapticsHost = {
  impact(style?: HapticImpactStyle): Promise<void>;
};

export type ClipboardHost = {
  writeText(text: string): Promise<boolean>;
};

export type PlatformHost = {
  readonly kind: PlatformKind;
  readonly secureStorage: SecureStorageHost;
  readonly playback: PlaybackHost;
  readonly sleepTimer: SleepTimerHost;
  readonly haptics: HapticsHost;
  readonly clipboard: ClipboardHost;
  /** Local library mirror; UI stays on {@link LibraryCacheStorage}, not on IndexedDB/SQLite directly. */
  readonly libraryCache: LibraryCacheStorage;
  /** Offline audio blobs keyed by library scope + track id. */
  readonly offlineMedia: OfflineMediaStore;
};
