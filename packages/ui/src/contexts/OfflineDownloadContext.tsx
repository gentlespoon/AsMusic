import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  libraryCacheScope,
  OfflineBulkJobQueue,
  PERSIST_WHILE_STREAMING_KEY,
  readPersistWhileStreamingEnabled,
  type OfflineBulkJobQueueSnapshot,
  type OfflineBulkJobTrack,
} from '@asmusic/core';
import { useHost } from '../host/HostContext';
import { useServerAndLibrary } from './ServerAndLibraryContext';

type OfflineDownloadContextValue = {
  queueSnapshot: OfflineBulkJobQueueSnapshot;
  persistWhileStreaming: boolean;
  setPersistWhileStreaming: (next: boolean) => Promise<void>;
  setQueuePaused: (paused: boolean) => void;
  cancelJob: (jobId: string) => void;
  cancelAllJobs: () => void;
  removePendingJob: (jobId: string) => void;
  moveJob: (jobId: string, delta: -1 | 1) => void;
  retryFailedTracks: (jobId: string) => Promise<void>;
  enqueueAlbumDownload: (opts: {
    serverId: string;
    libraryId: string;
    albumTitle: string;
    trackIds: string[];
  }) => void;
};

const OfflineDownloadContext = createContext<OfflineDownloadContextValue | null>(null);

export function OfflineDownloadProvider({ children }: { children: ReactNode }) {
  const host = useHost();
  const { servers, getStreamUrl } = useServerAndLibrary();
  const queueRef = useRef<OfflineBulkJobQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new OfflineBulkJobQueue(host.offlineMedia);
  }

  const [queueSnapshot, setQueueSnapshot] = useState<OfflineBulkJobQueueSnapshot>({
    jobs: [],
    pausedGlobally: false,
  });

  useEffect(() => {
    const q = queueRef.current;
    if (!q) return () => {};
    return q.subscribe(setQueueSnapshot);
  }, []);

  const [persistWhileStreaming, setPersistState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void host.secureStorage.get(PERSIST_WHILE_STREAMING_KEY).then((v) => {
      if (!cancelled) setPersistState(readPersistWhileStreamingEnabled(v));
    });
    return () => {
      cancelled = true;
    };
  }, [host]);

  const setPersistWhileStreaming = useCallback(
    async (next: boolean) => {
      setPersistState(next);
      await host.secureStorage.set(PERSIST_WHILE_STREAMING_KEY, next ? '1' : '0');
    },
    [host]
  );

  const setQueuePaused = useCallback((paused: boolean) => {
    queueRef.current?.setPausedGlobally(paused);
  }, []);

  const cancelJob = useCallback((jobId: string) => {
    queueRef.current?.cancelJob(jobId);
  }, []);

  const cancelAllJobs = useCallback(() => {
    queueRef.current?.cancelAll();
  }, []);

  const removePendingJob = useCallback((jobId: string) => {
    queueRef.current?.removePendingJob(jobId);
  }, []);

  const moveJob = useCallback((jobId: string, delta: -1 | 1) => {
    queueRef.current?.moveJob(jobId, delta);
  }, []);

  const retryFailedTracks = useCallback(async (jobId: string) => {
    await queueRef.current?.retryFailedTracks(jobId);
  }, []);

  const enqueueAlbumDownload = useCallback(
    (opts: { serverId: string; libraryId: string; albumTitle: string; trackIds: string[] }) => {
      const server = servers.find((s) => s.id === opts.serverId);
      if (!server) return;
      const scope = libraryCacheScope(server.serverUrl, server.username, opts.libraryId);
      const tracks: OfflineBulkJobTrack[] = [];
      for (const trackId of opts.trackIds) {
        const id = String(trackId);
        const u = getStreamUrl(opts.serverId, id);
        if (!u) continue;
        tracks.push({ key: { scope, trackId: id }, streamUrl: u });
      }
      queueRef.current?.enqueue({
        kind: 'album',
        label: opts.albumTitle,
        tracks,
      });
    },
    [servers, getStreamUrl]
  );

  const value = useMemo(
    () => ({
      queueSnapshot,
      persistWhileStreaming,
      setPersistWhileStreaming,
      setQueuePaused,
      cancelJob,
      cancelAllJobs,
      removePendingJob,
      moveJob,
      retryFailedTracks,
      enqueueAlbumDownload,
    }),
    [
      queueSnapshot,
      persistWhileStreaming,
      setPersistWhileStreaming,
      setQueuePaused,
      cancelJob,
      cancelAllJobs,
      removePendingJob,
      moveJob,
      retryFailedTracks,
      enqueueAlbumDownload,
    ]
  );

  return <OfflineDownloadContext.Provider value={value}>{children}</OfflineDownloadContext.Provider>;
}

export function useOfflineDownload(): OfflineDownloadContextValue {
  const v = useContext(OfflineDownloadContext);
  if (!v) {
    throw new Error('useOfflineDownload must be used within OfflineDownloadProvider');
  }
  return v;
}
