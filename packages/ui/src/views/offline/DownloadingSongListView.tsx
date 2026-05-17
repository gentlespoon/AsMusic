import { useMemo } from 'react';
import type { OfflineBulkJob } from '@asmusic/core';
import { Box, Chip, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import Block from '@mui/icons-material/Block';
import Cancel from '@mui/icons-material/Cancel';
import Close from '@mui/icons-material/Close';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Replay from '@mui/icons-material/Replay';
import { useT } from '@asmusic/i18n';
import { useOfflineDownload } from '../../contexts/OfflineDownloadContext';

function jobStateLabel(state: OfflineBulkJob['state']): string {
  switch (state) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return state;
  }
}

function jobProgress(job: OfflineBulkJob): number {
  if (job.tracks.length === 0) return 1;
  const done = job.completedIndices.size + job.failedIndices.size;
  return done / job.tracks.length;
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

  const hasActive = useMemo(
    () => jobs.some((j) => j.state === 'pending' || j.state === 'running'),
    [jobs]
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

      <Stack spacing={2}>
        {jobs.map((job, idx) => {
          const prog = jobProgress(job);
          const label = `${job.completedIndices.size}/${job.tracks.length} tracks`;
          return (
            <Box key={job.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
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
                    {job.kind} · {label}
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
                      <IconButton size="small" aria-label={t('offline.downloading.removeJob')} onClick={() => removePendingJob(job.id)}>
                        <Close fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('offline.downloading.moveUp')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t('offline.downloading.moveUp')}
                          disabled={idx === 0}
                          onClick={() => moveJob(job.id, -1)}
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
                          disabled={idx >= jobs.length - 1}
                          onClick={() => moveJob(job.id, 1)}
                        >
                          <KeyboardArrowDown fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                )}
                {(job.state === 'pending' || job.state === 'running') && (
                  <Tooltip title={t('offline.downloading.cancelJob')}>
                    <IconButton size="small" color="warning" aria-label={t('offline.downloading.cancelJob')} onClick={() => cancelJob(job.id)}>
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {job.failedIndices.size > 0 && job.state !== 'running' && (
                  <Tooltip title={t('offline.downloading.retryFailed')}>
                    <IconButton size="small" aria-label={t('offline.downloading.retryFailed')} onClick={() => void retryFailedTracks(job.id)}>
                      <Replay fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
