import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { createCapacitorIosSqliteLibraryCacheStorage } from './capacitorIosSqliteLibraryCacheStorage';
import { createCapacitorIosOfflineMediaStorage } from './capacitorIosOfflineMediaStorage';
import type {
  PlatformHost,
  PlaybackHost,
  PlaybackRemoteSessionPayload,
  PlaybackStatePayload,
  SecureStorageHost,
  SleepTimerHost,
} from '@asmusic/core';
import { AsmusicNative } from './asmusicNativePlugin';
import { capacitorClipboard } from './capacitorClipboard';
import { capacitorHaptics } from './capacitorHaptics';
import { installCapacitorOfflineMediaEventBridge } from './installCapacitorOfflineMediaEventBridge';

installCapacitorOfflineMediaEventBridge();

const libraryCache = createCapacitorIosSqliteLibraryCacheStorage();
const offlineMedia = createCapacitorIosOfflineMediaStorage();

const secureStorage: SecureStorageHost = {
  async get(key: string) {
    const { value } = await AsmusicNative.secureStorageGet({ key });
    return value ?? null;
  },
  async set(key: string, value: string) {
    await AsmusicNative.secureStorageSet({ key, value });
  },
  async remove(key: string) {
    await AsmusicNative.secureStorageRemove({ key });
  },
};

function buildPlayback(): PlaybackHost {
  const stateSubs = new Set<(s: PlaybackStatePayload) => void>();
  const endedSubs = new Set<() => void>();
  const errorSubs = new Set<(e: { message: string }) => void>();
  const skipNextSubs = new Set<() => void>();
  const skipPrevSubs = new Set<() => void>();
  const favoriteStarSubs = new Set<() => void>();
  const favoriteUnstarSubs = new Set<() => void>();

  let stateHandle: PluginListenerHandle | null = null;
  let remoteHandlesInitialized = false;

  const ensureListeners = async () => {
    if (stateHandle) return;
    stateHandle = await AsmusicNative.addListener('playbackState', (p) => {
      stateSubs.forEach((cb) => cb(p));
    });
    await AsmusicNative.addListener('playbackEnded', () => {
      endedSubs.forEach((cb) => cb());
    });
    await AsmusicNative.addListener('playbackError', (p) => {
      errorSubs.forEach((cb) => cb(p));
    });
  };

  const ensureRemoteHandles = async () => {
    if (remoteHandlesInitialized) return;
    remoteHandlesInitialized = true;
    await AsmusicNative.addListener('playbackRemoteSkipNext', () => {
      skipNextSubs.forEach((cb) => cb());
    });
    await AsmusicNative.addListener('playbackRemoteSkipPrevious', () => {
      skipPrevSubs.forEach((cb) => cb());
    });
    await AsmusicNative.addListener('playbackRemoteFavoriteStar', () => {
      favoriteStarSubs.forEach((cb) => cb());
    });
    await AsmusicNative.addListener('playbackRemoteFavoriteUnstar', () => {
      favoriteUnstarSubs.forEach((cb) => cb());
    });
  };

  void ensureRemoteHandles();

  return {
    async loadUrl(url, meta) {
      await ensureListeners();
      await AsmusicNative.playbackLoadUrl({
        url,
        localFilePath: meta?.localFilePath,
        title: meta?.title,
        artist: meta?.artist,
        album: meta?.album,
        artworkUrl: meta?.artworkUrl ?? undefined,
      });
    },
    async play() {
      await ensureListeners();
      await AsmusicNative.playbackPlay();
    },
    async pause() {
      await AsmusicNative.playbackPause();
    },
    async seek(positionSeconds: number) {
      await AsmusicNative.playbackSeek({ positionSeconds });
    },
    async syncRemoteSession(payload: PlaybackRemoteSessionPayload) {
      await AsmusicNative.playbackSyncRemoteSession(payload);
    },
    onPlaybackState(cb) {
      void ensureListeners();
      stateSubs.add(cb);
      return () => stateSubs.delete(cb);
    },
    onPlaybackEnded(cb) {
      void ensureListeners();
      endedSubs.add(cb);
      return () => endedSubs.delete(cb);
    },
    onPlaybackError(cb) {
      void ensureListeners();
      errorSubs.add(cb);
      return () => errorSubs.delete(cb);
    },
    onRemoteSkipNext(cb) {
      void ensureRemoteHandles();
      skipNextSubs.add(cb);
      return () => skipNextSubs.delete(cb);
    },
    onRemoteSkipPrevious(cb) {
      void ensureRemoteHandles();
      skipPrevSubs.add(cb);
      return () => skipPrevSubs.delete(cb);
    },
    onRemoteFavoriteStar(cb) {
      void ensureRemoteHandles();
      favoriteStarSubs.add(cb);
      return () => favoriteStarSubs.delete(cb);
    },
    onRemoteFavoriteUnstar(cb) {
      void ensureRemoteHandles();
      favoriteUnstarSubs.add(cb);
      return () => favoriteUnstarSubs.delete(cb);
    },
  };
}

function buildSleepTimer(): SleepTimerHost {
  const elapsedSubs = new Set<() => void>();
  let elapsedHandle: PluginListenerHandle | null = null;

  const ensureElapsedListener = async () => {
    if (elapsedHandle) return;
    elapsedHandle = await AsmusicNative.addListener('sleepTimerElapsed', () => {
      elapsedSubs.forEach((cb) => cb());
    });
  };

  return {
    async setDeadline(endsAtEpochMs: number | null) {
      await ensureElapsedListener();
      await AsmusicNative.sleepTimerSet({ endsAtEpochMs });
    },
    async getDeadline() {
      const { endsAtEpochMs } = await AsmusicNative.sleepTimerGet();
      return endsAtEpochMs ?? null;
    },
    onElapsed(cb) {
      void ensureElapsedListener();
      elapsedSubs.add(cb);
      return () => elapsedSubs.delete(cb);
    },
  };
}

export const iosCapacitorHost: PlatformHost = {
  kind: 'ios-capacitor',
  secureStorage,
  playback: buildPlayback(),
  sleepTimer: buildSleepTimer(),
  haptics: capacitorHaptics,
  clipboard: capacitorClipboard,
  libraryCache,
  offlineMedia,
};

export function isIosCapacitorShell(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}
