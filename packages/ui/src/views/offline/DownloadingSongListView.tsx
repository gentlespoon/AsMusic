import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Child } from 'subsonic-api';
import type { LibraryCacheScope, OfflineBulkJob, SubsonicAPI } from '@asmusic/core';
import { serverAccountKey } from '@asmusic/core';
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Block from '@mui/icons-material/Block';
import Cancel from '@mui/icons-material/Cancel';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import Error from '@mui/icons-material/Error';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Replay from '@mui/icons-material/Replay';
import type { MessageKey } from '@asmusic/i18n';
import { useT } from '@asmusic/i18n';
import { useHost } from '@ui/host/HostContext';
import { useServerAndLibrary } from '@ui/contexts';
import { useOfflineDownload } from '@ui/contexts/OfflineDownloadContext';
import { SongItemMain } from '@ui/shared/songItem/SongItemMain';
import { createPersistCachedArtworkForScope } from '@ui/shared/libraryArtworkCacheAccess';
import { createResolveCachedArtwork } from '@ui/shared/createResolveCachedArtwork';
import { rowSx } from '@ui/shared/songItem/constants';

type TrackStatus = 'pending' | 'downloading' | 'completed' | 'failed';

type ScopeResources = {
  trackByKey: Map<string, Child>;
  apiByScopeKey: Map<string, SubsonicAPI | null>;
  serverByScopeKey: Map<string, { serverUrl: string; username: string }>;
};

function scopeKey(scope: LibraryCacheScope): string {
  return `${scope.serverKey}|${scope.libraryId}`;
}

function trackLookupKey(scope: LibraryCacheScope, trackId: string): string {
  return `${scopeKey(scope)}|${trackId}`;
}

function syntheticTrack(trackId: string): Child {
  return { id: trackId, title: trackId, isDir: false };
}

function isActiveJobState(state: OfflineBulkJob['state']): boolean {
  return state === 'pending' || state === 'running' || state === 'paused';
}

function jobProgress(job: OfflineBulkJob): number {
  if (job.tracks.length === 0) return 1;
  const done = job.completedIndices.size + job.failedIndices.size;
  return done / job.tracks.length;
}

function trackStatus(job: OfflineBulkJob, index: number): TrackStatus {
  if (job.completedIndices.has(index)) return 'completed';
  if (job.failedIndices.has(index)) return 'failed';
  if (job.currentIndex === index) return 'downloading';
  return 'pending';
}

function jobTracksFingerprint(jobs: OfflineBulkJob[]): string {
  const parts: string[] = [];
  for (const job of jobs) {
    parts.push(job.id);
    for (const track of job.tracks) {
      parts.push(`${track.key.scope.serverKey}|${track.key.scope.libraryId}|${track.key.trackId}`);
    }
  }
  return parts.join('\n');
}

function useJobScopeResources(jobs: OfflineBulkJob[]): ScopeResources {
  const host = useHost();
  const { servers, getApiForServer } = useServerAndLibrary();
  const tracksFingerprint = useMemo(() => jobTracksFingerprint(jobs), [jobs]);
  const [resources, setResources] = useState<ScopeResources>({
    trackByKey: new Map(),
    apiByScopeKey: new Map(),
    serverByScopeKey: new Map(),
  });

  useEffect(() => {
    let cancelled = false;
    const scopes = new Map<string, LibraryCacheScope>();
    for (const job of jobs) {
      for (const track of job.tracks) {
        scopes.set(scopeKey(track.key.scope), track.key.scope);
      }
    }

    void (async () => {
      const trackByKey = new Map<string, Child>();
      const apiByScopeKey = new Map<string, SubsonicAPI | null>();
      const serverByScopeKey = new Map<string, { serverUrl: string; username: string }>();

      await Promise.all(
        [...scopes.entries()].map(async ([sk, scope]) => {
          const [songs, server] = await Promise.all([
            host.libraryCache.readSongList(scope),
            Promise.resolve(
              servers.find((s) => serverAccountKey(s.serverUrl, s.username) === scope.serverKey)
            ),
          ]);
          for (const song of songs) {
            trackByKey.set(trackLookupKey(scope, String(song.id)), song);
          }
          const api = server ? await getApiForServer(server.id) : null;
          apiByScopeKey.set(sk, api);
          if (server) {
            serverByScopeKey.set(sk, { serverUrl: server.serverUrl, username: server.username });
          }
        })
      );

      if (!cancelled) {
        setResources({ trackByKey, apiByScopeKey, serverByScopeKey });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [host, servers, getApiForServer, tracksFingerprint, jobs]);

  return resources;
}

function TrackStatusIcon({ status }: { status: TrackStatus }) {
  switch (status) {
    case 'downloading':
      return <CircularProgress size={18} sx={{ flexShrink: 0, mx: 1 }} />;
    case 'completed':
      return <CheckCircle fontSize="small" color="success" sx={{ flexShrink: 0, mx: 1 }} />;
    case 'failed':
      return <Error fontSize="small" color="error" sx={{ flexShrink: 0, mx: 1 }} />;
    default:
      return <HourglassEmpty fontSize="small" color="disabled" sx={{ flexShrink: 0, mx: 1 }} />;
  }
}

function DownloadingTrackRow({
  track,
  status,
  scope,
  api,
  statusLabel,
  serverUrl,
  username,
}: {
  track: Child;
  status: TrackStatus;
  scope: LibraryCacheScope;
  api: SubsonicAPI | null;
  statusLabel: string;
  serverUrl?: string;
  username?: string;
}) {
  const host = useHost();
  const coverArtId = track.coverArt?.trim() || undefined;
  const secondary = (
    <Typography component="span" variant="caption" color={status === 'failed' ? 'error' : 'text.secondary'}>
      {statusLabel}
    </Typography>
  );

  return (
    <ListItem divider disablePadding sx={{ alignItems: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', py: rowSx.py, px: rowSx.px }}>
        <SongItemMain
          track={track}
          secondary={secondary}
          noWrapSecondary
          api={api}
          coverArtId={coverArtId}
          resolveCachedArtwork={(coverArtIdArg) => {
            if (serverUrl && username) {
              return createResolveCachedArtwork(
                host.libraryCache,
                serverUrl,
                username,
                scope.libraryId,
              )(coverArtIdArg);
            }
            return host.libraryCache.readArtworkBlob(scope, coverArtIdArg);
          }}
          resolveArtworkLocalFile={
            host.libraryCache.readArtworkLocalFile
              ? (coverArtIdArg) => host.libraryCache.readArtworkLocalFile!(scope, coverArtIdArg)
              : undefined
          }
          persistCachedArtwork={createPersistCachedArtworkForScope(host.libraryCache, scope)}
          artworkCacheBump={0}
          artworkCacheKey={scopeKey(scope)}
        />
      </Box>
      <TrackStatusIcon status={status} />
    </ListItem>
  );
}

function DownloadingJobCard({
  job,
  jobIndex,
  jobCount,
  expanded,
  onToggleExpanded,
  trackStatusLabel,
  jobStateLabel,
  jobKindLabel,
  progressLabel,
  resources,
  t,
  onRemovePending,
  onMoveUp,
  onMoveDown,
  onCancel,
  onRetryFailed,
}: {
  job: OfflineBulkJob;
  jobIndex: number;
  jobCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  trackStatusLabel: (status: TrackStatus) => string;
  jobStateLabel: (state: OfflineBulkJob['state']) => string;
  jobKindLabel: (kind: OfflineBulkJob['kind']) => string;
  progressLabel: string;
  resources: ScopeResources;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  onRemovePending: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
}) {
  const prog = jobProgress(job);
  const expandLabel = expanded ? t('offline.downloading.collapseJob') : t('offline.downloading.expandJob');

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      <Stack sx={{ flexDirection: 'row', alignItems: 'flex-start', gap: 0.5 }}>
        <Tooltip title={expandLabel}>
          <IconButton
            size="small"
            aria-label={expandLabel}
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            sx={{ mt: -0.25 }}
          >
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            sx={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {job.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {jobKindLabel(job.kind)} · {progressLabel}
              </Typography>
              {job.errorMessage && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  {job.errorMessage}
                </Typography>
              )}
            </Box>
            <Chip size="small" label={jobStateLabel(job.state)} />
          </Stack>
          <LinearProgress variant="determinate" value={prog * 100} sx={{ mt: 1 }} />
          <Stack sx={{ mt: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            {job.state === 'pending' && (
              <>
                <Tooltip title={t('offline.downloading.removeJob')}>
                  <IconButton size="small" aria-label={t('offline.downloading.removeJob')} onClick={onRemovePending}>
                    <Close fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('offline.downloading.moveUp')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('offline.downloading.moveUp')}
                      disabled={jobIndex === 0}
                      onClick={onMoveUp}
                    >
                      <KeyboardArrowUp fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('offline.downloading.moveDown')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('offline.downloading.moveDown')}
                      disabled={jobIndex >= jobCount - 1}
                      onClick={onMoveDown}
                    >
                      <KeyboardArrowDown fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
            {(job.state === 'pending' || job.state === 'running') && (
              <Tooltip title={t('offline.downloading.cancelJob')}>
                <IconButton size="small" color="warning" aria-label={t('offline.downloading.cancelJob')} onClick={onCancel}>
                  <Cancel fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {job.failedIndices.size > 0 && job.state !== 'running' && (
              <Tooltip title={t('offline.downloading.retryFailed')}>
                <IconButton size="small" aria-label={t('offline.downloading.retryFailed')} onClick={onRetryFailed}>
                  <Replay fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Stack>

      <Collapse in={expanded}>
        <List dense disablePadding sx={{ mt: 1 }}>
          {job.tracks.map((trackRef, index) => {
            const status = trackStatus(job, index);
            const child =
              resources.trackByKey.get(trackLookupKey(trackRef.key.scope, trackRef.key.trackId)) ??
              syntheticTrack(trackRef.key.trackId);
            const sk = scopeKey(trackRef.key.scope);
            const api = resources.apiByScopeKey.get(sk) ?? null;
            const server = resources.serverByScopeKey.get(sk);
            return (
              <DownloadingTrackRow
                key={`${trackRef.key.trackId}-${index}`}
                track={child}
                status={status}
                scope={trackRef.key.scope}
                api={api}
                statusLabel={trackStatusLabel(status)}
                serverUrl={server?.serverUrl}
                username={server?.username}
              />
            );
          })}
        </List>
      </Collapse>
    </Box>
  );
}

function JobSection({
  title,
  jobs,
  allJobs,
  renderJobCard,
}: {
  title?: string;
  jobs: OfflineBulkJob[];
  allJobs: OfflineBulkJob[];
  renderJobCard: (job: OfflineBulkJob, jobIndex: number) => ReactNode;
}) {
  if (jobs.length === 0) return null;

  return (
    <Box>
      {title && (
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {title}
        </Typography>
      )}
      <Stack spacing={2}>
        {jobs.map((job) => {
          const jobIndex = allJobs.findIndex((j) => j.id === job.id);
          return renderJobCard(job, jobIndex);
        })}
      </Stack>
    </Box>
  );
}

export function DownloadingSongListView() {
  const t = useT();
  const {
    queueSnapshot,
    setQueuePaused,
    cancelJob,
    cancelAllJobs,
    removePendingJob,
    moveJob,
    retryFailedTracks,
  } = useOfflineDownload();

  const { jobs, pausedGlobally } = queueSnapshot;
  const resources = useJobScopeResources(jobs);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(() => new Set());

  const runningJobId = jobs.find((j) => j.state === 'running')?.id;

  useEffect(() => {
    if (!runningJobId) return;
    setExpandedJobIds((prev) => {
      if (prev.has(runningJobId)) return prev;
      const next = new Set(prev);
      next.add(runningJobId);
      return next;
    });
  }, [runningJobId]);

  const toggleExpanded = useCallback((jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const activeJobs = useMemo(() => jobs.filter((j) => isActiveJobState(j.state)), [jobs]);
  const finishedJobs = useMemo(() => jobs.filter((j) => !isActiveJobState(j.state)), [jobs]);

  const hasActive = activeJobs.length > 0;

  const jobStateLabel = useCallback(
    (state: OfflineBulkJob['state']) => {
      switch (state) {
        case 'pending':
          return t('offline.downloading.jobState.pending');
        case 'running':
          return t('offline.downloading.jobState.running');
        case 'paused':
          return t('offline.downloading.jobState.paused');
        case 'completed':
          return t('offline.downloading.jobState.completed');
        case 'failed':
          return t('offline.downloading.jobState.failed');
        case 'cancelled':
          return t('offline.downloading.jobState.cancelled');
        default:
          return state;
      }
    },
    [t]
  );

  const trackStatusLabel = useCallback(
    (status: TrackStatus) => {
      switch (status) {
        case 'downloading':
          return t('offline.downloading.trackState.downloading');
        case 'completed':
          return t('offline.downloading.trackState.completed');
        case 'failed':
          return t('offline.downloading.trackState.failed');
        default:
          return t('offline.downloading.trackState.pending');
      }
    },
    [t]
  );

  const jobKindLabel = useCallback(
    (kind: OfflineBulkJob['kind']) => {
      switch (kind) {
        case 'album':
          return t('offline.downloading.jobKind.album');
        case 'playlist':
          return t('offline.downloading.jobKind.playlist');
        case 'tracks':
          return t('offline.downloading.jobKind.tracks');
        default:
          return kind;
      }
    },
    [t]
  );

  const progressLabelForJob = useCallback(
    (job: OfflineBulkJob) =>
      t('offline.downloading.progress', {
        done: job.completedIndices.size,
        total: job.tracks.length,
      }),
    [t]
  );

  const renderJobCard = useCallback(
    (job: OfflineBulkJob, jobIndex: number) => (
      <DownloadingJobCard
        key={job.id}
        job={job}
        jobIndex={jobIndex}
        jobCount={jobs.length}
        expanded={expandedJobIds.has(job.id)}
        onToggleExpanded={() => toggleExpanded(job.id)}
        trackStatusLabel={trackStatusLabel}
        jobStateLabel={jobStateLabel}
        jobKindLabel={jobKindLabel}
        progressLabel={progressLabelForJob(job)}
        resources={resources}
        t={t}
        onRemovePending={() => removePendingJob(job.id)}
        onMoveUp={() => moveJob(job.id, -1)}
        onMoveDown={() => moveJob(job.id, 1)}
        onCancel={() => cancelJob(job.id)}
        onRetryFailed={() => void retryFailedTracks(job.id)}
      />
    ),
    [
      jobs.length,
      expandedJobIds,
      toggleExpanded,
      trackStatusLabel,
      jobStateLabel,
      jobKindLabel,
      progressLabelForJob,
      resources,
      t,
      removePendingJob,
      moveJob,
      cancelJob,
      retryFailedTracks,
    ]
  );

  return (
    <Box>
      <Stack sx={{ mb: 2, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={pausedGlobally ? t('offline.downloading.resumeQueue') : t('offline.downloading.pauseQueue')}>
          <IconButton
            size="small"
            aria-label={pausedGlobally ? t('offline.downloading.resumeQueue') : t('offline.downloading.pauseQueue')}
            onClick={() => setQueuePaused(!pausedGlobally)}
          >
            {pausedGlobally ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t('offline.downloading.cancelAll')}>
          <span>
            <IconButton
              size="small"
              color="warning"
              aria-label={t('offline.downloading.cancelAll')}
              onClick={cancelAllJobs}
              disabled={!hasActive}
            >
              <Block fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {jobs.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('offline.downloading.empty')}
        </Typography>
      )}

      <Stack spacing={3}>
        <JobSection jobs={activeJobs} allJobs={jobs} renderJobCard={renderJobCard} />
        <JobSection
          title={finishedJobs.length > 0 ? t('offline.downloading.finishedSection') : undefined}
          jobs={finishedJobs}
          allJobs={jobs}
          renderJobCard={renderJobCard}
        />
      </Stack>
    </Box>
  );
}
