import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useHost } from '@ui/host/HostContext';
import { PlayerManager, type PlayerSleepTimerSnapshot, type SavedServerRef } from '@ui/player/core/PlayerManager';
import type { PlayerQueueItem, PlayerToastEvent, PlayerViewState } from '@ui/player/core/types';
import { useServerAndLibrary } from './ServerAndLibraryContext';
import { useLibraryBrowseCache } from './LibraryBrowseCacheContext';
import {
  clearPlayerDebugLog,
  copyPlayerDebugLogToClipboard,
} from '@ui/player/core/playerDebugLog';

export type PlayerActions = {
  replaceQueueAndPlay: (items: PlayerQueueItem[], startIndex: number) => Promise<void>;
  appendToQueue: (items: PlayerQueueItem[]) => Promise<void>;
  insertAfterCurrent: (items: PlayerQueueItem[], options?: { playFirst?: boolean }) => Promise<void>;
  playQueueIndex: (index: number) => Promise<void>;
  removeQueueIndex: (index: number) => Promise<void>;
  duplicateQueueIndexToEnd: (index: number) => void;
  moveQueueIndexToPlayNext: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueueExceptCurrent: () => void;
  reshuffleQueuePreservingCurrent: () => Promise<void>;
  toggleLoopQueue: () => void;
  toggleLoopOne: () => void;
  togglePlayPause: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionSeconds: number) => Promise<void>;
  seekBy: (deltaSeconds: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  toggleFullPlayer: () => void;
  setSleepTimerMinutes: (minutes: number) => Promise<void>;
  cancelSleepTimer: () => Promise<void>;
  patchCurrentQueueItemStarred: (starred: boolean) => void;
  syncCurrentTrackNowPlayingArtwork: () => Promise<void>;
};

export type PlayerShell = {
  fullPlayerOpen: boolean;
};

const PlayerManagerContext = createContext<PlayerManager | null>(null);
const PlayerActionsContext = createContext<PlayerActions | null>(null);
const PlayerTransportContext = createContext<PlayerViewState | null>(null);
const PlayerShellContext = createContext<PlayerShell | null>(null);

function usePlayerManager(): PlayerManager {
  const m = useContext(PlayerManagerContext);
  if (!m) {
    throw new Error('usePlayerManager must be used within PlayerProvider');
  }
  return m;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const host = useHost();
  const { setTrackStarred, libraryDisplayName, serverDisplayName, ensureLibraryNames } =
    useLibraryBrowseCache();
  const { getStreamUrl, getCoverArtUrl, ensureStreamReady, servers, activeLibraryRefs, isRestoring } =
    useServerAndLibrary();
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);

  const depsRef = useRef({
    getStreamUrl,
    getCoverArtUrl,
    ensureStreamReady,
    activeLibraryRefs,
    libraryDisplayName,
    serverDisplayName,
    ensureLibraryNames,
  });
  depsRef.current = {
    getStreamUrl,
    getCoverArtUrl,
    ensureStreamReady,
    activeLibraryRefs,
    libraryDisplayName,
    serverDisplayName,
    ensureLibraryNames,
  };

  const manager = useMemo(
    () =>
      new PlayerManager(host, {
        getStreamUrl: (serverId, trackId) => depsRef.current.getStreamUrl(serverId, trackId),
        getCoverArtUrl: (serverId, coverArtId) =>
          depsRef.current.getCoverArtUrl(serverId, coverArtId),
        ensureStreamReady: (serverId) => depsRef.current.ensureStreamReady(serverId),
        isLibraryActive: (serverId, libraryId) =>
          depsRef.current.activeLibraryRefs.some(
            (r) => r.serverId === serverId && r.libraryId === libraryId
          ),
        getLibraryDisplayName: (serverId, libraryId) =>
          depsRef.current.libraryDisplayName(serverId, libraryId),
        getServerDisplayName: (serverId) => depsRef.current.serverDisplayName(serverId),
        ensureLibraryNames: (refs) => depsRef.current.ensureLibraryNames(refs),
      }),
    [host]
  );

  useEffect(() => {
    return () => {
      manager.dispose();
    };
  }, [manager]);

  useEffect(() => {
  type AsMusicDebugWindow = Window & {
    __asmusicCopyPlayerDebugLog?: () => Promise<string>;
    __asmusicClearPlayerDebugLog?: () => Promise<void>;
  };
    const w = window as AsMusicDebugWindow;
    w.__asmusicCopyPlayerDebugLog = () => copyPlayerDebugLogToClipboard(host);
    w.__asmusicClearPlayerDebugLog = () => clearPlayerDebugLog(host);
    return () => {
      delete w.__asmusicCopyPlayerDebugLog;
      delete w.__asmusicClearPlayerDebugLog;
    };
  }, [host]);

  useEffect(() => {
    const p = host.playback;
    const unsubs: Array<() => void> = [];
    if (p.onRemoteSkipNext) {
      unsubs.push(
        p.onRemoteSkipNext(() => {
          void manager.skipNext();
        })
      );
    }
    if (p.onRemoteSkipPrevious) {
      unsubs.push(
        p.onRemoteSkipPrevious(() => {
          void manager.skipPrevious();
        })
      );
    }
    if (p.onRemoteFavoriteStar) {
      unsubs.push(
        p.onRemoteFavoriteStar(() => {
          const item = manager.getSnapshot().currentItem;
          if (!item) return;
          manager.patchCurrentQueueItemStarred(true);
          void setTrackStarred({
            serverId: item.serverId,
            libraryId: item.libraryId,
            trackId: item.trackId,
            starred: true,
          }).catch((e: unknown) => console.warn('[AsMusic] remote favorite star failed', e));
        })
      );
    }
    if (p.onRemoteFavoriteUnstar) {
      unsubs.push(
        p.onRemoteFavoriteUnstar(() => {
          const item = manager.getSnapshot().currentItem;
          if (!item) return;
          manager.patchCurrentQueueItemStarred(false);
          void setTrackStarred({
            serverId: item.serverId,
            libraryId: item.libraryId,
            trackId: item.trackId,
            starred: false,
          }).catch((e: unknown) => console.warn('[AsMusic] remote favorite unstar failed', e));
        })
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [host, manager, setTrackStarred]);

  const openFullPlayer = useCallback(() => setFullPlayerOpen(true), []);
  const closeFullPlayer = useCallback(() => setFullPlayerOpen(false), []);
  const toggleFullPlayer = useCallback(() => setFullPlayerOpen((o) => !o), []);

  useEffect(() => {
    if (isRestoring) return;
    const refs: SavedServerRef[] = servers.map((s) => ({
      id: s.id,
      serverUrl: s.serverUrl,
      username: s.username,
    }));
    void manager.hydrateFromPersistence(refs);
  }, [manager, isRestoring, servers]);

  const actions = useMemo<PlayerActions>(
    () => ({
      replaceQueueAndPlay: (items, startIndex) => manager.replaceQueueAndPlay(items, startIndex),
      appendToQueue: (items) => manager.appendToQueue(items),
      insertAfterCurrent: (items, options) => manager.insertAfterCurrent(items, options),
      playQueueIndex: (index) => manager.playQueueIndex(index),
      removeQueueIndex: (index) => manager.removeQueueIndex(index),
      duplicateQueueIndexToEnd: (index) => manager.duplicateQueueIndexToEnd(index),
      moveQueueIndexToPlayNext: (index) => manager.moveQueueIndexToPlayNext(index),
      reorderQueue: (from, to) => manager.reorderQueue(from, to),
      clearQueueExceptCurrent: () => manager.clearQueueExceptCurrent(),
      reshuffleQueuePreservingCurrent: () => manager.reshuffleQueuePreservingCurrent(),
      toggleLoopQueue: () => manager.toggleLoopQueue(),
      toggleLoopOne: () => manager.toggleLoopOne(),
      togglePlayPause: () => manager.togglePlayPause(),
      play: () => manager.play(),
      pause: () => manager.pause(),
      seek: (positionSeconds) => manager.seek(positionSeconds),
      seekBy: (deltaSeconds) => manager.seekBy(deltaSeconds),
      skipNext: () => manager.skipNext(),
      skipPrevious: () => manager.skipPrevious(),
      openFullPlayer,
      closeFullPlayer,
      toggleFullPlayer,
      setSleepTimerMinutes: (minutes) => manager.setSleepTimerMinutes(minutes),
      cancelSleepTimer: () => manager.cancelSleepTimer(),
      patchCurrentQueueItemStarred: (starred) => manager.patchCurrentQueueItemStarred(starred),
      syncCurrentTrackNowPlayingArtwork: () => manager.syncCurrentTrackNowPlayingArtwork(),
    }),
    [manager, openFullPlayer, closeFullPlayer, toggleFullPlayer]
  );

  const shell = useMemo<PlayerShell>(() => ({ fullPlayerOpen }), [fullPlayerOpen]);

  return (
    <PlayerManagerContext.Provider value={manager}>
      <PlayerActionsContext.Provider value={actions}>
        <PlayerShellContext.Provider value={shell}>{children}</PlayerShellContext.Provider>
      </PlayerActionsContext.Provider>
    </PlayerManagerContext.Provider>
  );
}

/**
 * Subscribes to playback transport state. Only components that call {@link usePlayerTransportState}
 * re-render on transport ticks; wrapping the router is safe as long as routes do not use that hook.
 * The router is included so portaled player UI (e.g. MUI `Dialog`) always sees this provider.
 */
export function PlayerTransportRoot({ children }: { children: ReactNode }) {
  const manager = usePlayerManager();
  const transportState = useSyncExternalStore(
    (onStoreChange) => manager.subscribe(onStoreChange),
    () => manager.getSnapshot(),
    () => manager.getSnapshot()
  );
  return <PlayerTransportContext.Provider value={transportState}>{children}</PlayerTransportContext.Provider>;
}

export function usePlayerActions(): PlayerActions {
  const ctx = useContext(PlayerActionsContext);
  if (!ctx) {
    throw new Error('usePlayerActions must be used within PlayerProvider');
  }
  return ctx;
}

export function usePlayerTransportState(): PlayerViewState {
  const ctx = useContext(PlayerTransportContext);
  if (!ctx) {
    throw new Error(
      'usePlayerTransportState must be used within PlayerTransportRoot (wrap player UI only, not the whole app)'
    );
  }
  return ctx;
}

export function usePlayerShell(): PlayerShell {
  const ctx = useContext(PlayerShellContext);
  if (!ctx) {
    throw new Error('usePlayerShell must be used within PlayerProvider');
  }
  return ctx;
}

export function usePlayerSleepTimer(): PlayerSleepTimerSnapshot {
  const manager = usePlayerManager();
  return useSyncExternalStore(
    (onStoreChange) => manager.subscribeSleepTimer(onStoreChange),
    () => manager.getSleepTimerSnapshot(),
    () => manager.getSleepTimerSnapshot()
  );
}

export function usePlayerToast(): PlayerToastEvent | null {
  const manager = usePlayerManager();
  return useSyncExternalStore(
    (onStoreChange) => manager.subscribeToast(onStoreChange),
    () => manager.getToastSnapshot(),
    () => manager.getToastSnapshot()
  );
}
