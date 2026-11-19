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
  offlineLookupScopes,
  offlineMediaKeyFromId,
  OFFLINE_MEDIA_STREAM_VARIANT,
  OfflineBulkJobQueue,
  PERSIST_WHILE_STREAMING_KEY,
  readPersistWhileStreamingEnabled,
  STREAM_FORMAT,
  subscribeOfflineMediaDiscarded,
  type OfflineBulkJobQueueSnapshot,
  type OfflineBulkJobTrack,
} from '@asmusic/core';
import { useHost } from '@ui/host/HostContext';
import { appendPlayerDebugLog } from '@ui/player/core/playerDebugLog';
import { offlineMediaVariantForCurrentStream } from '@ui/preferences/serverTranscodePreference';
import { useServerAndLibrary } from './ServerAndLibraryContext';

/** Stream URL whose `format` matches the offline variant that was discarded. */
function streamUrlForOfflineVariant(streamUrl: string, variant: string | undefined): string {
  try {
    const url = new URL(streamUrl);
    const stored = variant ?? '';
    if (stored === OFFLINE_MEDIA_STREAM_VARIANT) {
      url.searchParams.set('format', STREAM_FORMAT);
    } else if (stored.length === 0) {
      url.searchParams.delete('format');
    }
    return url.toString();
  } catch {
    return streamUrl;
  }
}

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
  enqueuePlaylistDownload: (opts: {
    serverId: string;
    libraryId: string;
    playlistTitle: string;
    trackIds: string[];
  }) => void;
  enqueueTrackDownload: (opts: {
    serverId: string;
    libraryId: string;
    trackTitle: string;
    trackId: string;
  }) => void;
};

const OfflineDownloadContext = createContext<OfflineDownloadContextValue | null>(null);

export function OfflineDownloadProvider({ children }: { children: ReactNode }) {
  const host = useHost();
  const { servers, getStreamUrl } = useServerAndLibrary();
  const serversRef = useRef(servers);
  const getStreamUrlRef = useRef(getStreamUrl);
  serversRef.current = servers;
  getStreamUrlRef.current = getStreamUrl;
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

  useEffect(() => {
    const inflight = new Set<string>();
    return subscribeOfflineMediaDiscarded((cacheKey) => {
      if (inflight.has(cacheKey)) return;
      const key = offlineMediaKeyFromId(cacheKey);
      if (!key) return;
      const server = serversRef.current.find((candidate) =>
        offlineLookupScopes(candidate.serverUrl, candidate.username, key.scope.libraryId).some(
          (scope) => scope.serverKey === key.scope.serverKey,
        ),
      );
      const streamUrl = server ? getStreamUrlRef.current(server.id, key.trackId) : null;
      if (!server || !streamUrl) {
        void appendPlayerDebugLog(host, 'OfflineDownload', 'discarded unplayable copy, retry skipped', {
          trackId: key.trackId,
          variant: key.variant ?? '',
          reason: server ? 'no-stream-url' : 'no-server',
        });
        return;
      }
      const url = streamUrlForOfflineVariant(streamUrl, key.variant);
      inflight.add(cacheKey);
      void appendPlayerDebugLog(host, 'OfflineDownload', 'redownload discarded copy', {
        trackId: key.trackId,
        variant: key.variant ?? '',
      });
      void host.offlineMedia
        .importFromAuthenticatedUrl(key, url)
        .then(() => {
          void appendPlayerDebugLog(host, 'OfflineDownload', 'redownload finished', {
            trackId: key.trackId,
            variant: key.variant ?? '',
          });
        })
        .catch((error: unknown) => {
          // A rejected body is not stored, so this does not emit another discard.
          void appendPlayerDebugLog(host, 'OfflineDownload', 'redownload failed', {
            trackId: key.trackId,
            variant: key.variant ?? '',
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          inflight.delete(cacheKey);
        });
    });
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

  const enqueueTracksDownload = useCallback(
    (opts: {
      serverId: string;
      libraryId: string;
      label: string;
      trackIds: string[];
      kind: 'album' | 'playlist' | 'tracks';
    }) => {
      const server = servers.find((s) => s.id === opts.serverId);
      if (!server) return;
      const scope = libraryCacheScope(server.serverUrl, server.username, opts.libraryId);
      const tracks: OfflineBulkJobTrack[] = [];
      for (const trackId of opts.trackIds) {
        const id = String(trackId);
        const u = getStreamUrl(opts.serverId, id);
        if (!u) continue;
        tracks.push({
          key: {
            scope,
            trackId: id,
            variant: offlineMediaVariantForCurrentStream(),
          },
          streamUrl: u,
        });
      }
      queueRef.current?.enqueue({
        kind: opts.kind,
        label: opts.label,
        tracks,
      });
    },
    [servers, getStreamUrl]
  );

  const enqueueAlbumDownload = useCallback(
    (opts: { serverId: string; libraryId: string; albumTitle: string; trackIds: string[] }) => {
      enqueueTracksDownload({
        serverId: opts.serverId,
        libraryId: opts.libraryId,
        label: opts.albumTitle,
        trackIds: opts.trackIds,
        kind: 'album',
      });
    },
    [enqueueTracksDownload]
  );

  const enqueuePlaylistDownload = useCallback(
    (opts: { serverId: string; libraryId: string; playlistTitle: string; trackIds: string[] }) => {
      enqueueTracksDownload({
        serverId: opts.serverId,
        libraryId: opts.libraryId,
        label: opts.playlistTitle,
        trackIds: opts.trackIds,
        kind: 'playlist',
      });
    },
    [enqueueTracksDownload]
  );

  const enqueueTrackDownload = useCallback(
    (opts: { serverId: string; libraryId: string; trackTitle: string; trackId: string }) => {
      enqueueTracksDownload({
        serverId: opts.serverId,
        libraryId: opts.libraryId,
        label: opts.trackTitle,
        trackIds: [opts.trackId],
        kind: 'tracks',
      });
    },
    [enqueueTracksDownload]
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
      enqueuePlaylistDownload,
      enqueueTrackDownload,
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
      enqueuePlaylistDownload,
      enqueueTrackDownload,
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
