import { useCallback, useEffect, useState } from 'react';
import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import Delete from '@mui/icons-material/Delete';
import {
  AppBar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageCloseButton } from '../../shared/PageCloseButton';
import { DownloadedSongListView } from './DownloadedSongListView';
import { DownloadingSongListView } from './DownloadingSongListView';
import { useHost } from '../../host/HostContext';
import { useOfflineDownload } from '../../contexts/OfflineDownloadContext';
import { libraryFlexFillSx } from '../../shared/LibraryVirtuosoFill';
import { playerDockPaddingBottomSx } from '../../player/core/constants';
import { formatBytes } from '../../utils/formatBytes';

export function OfflineDownloadedView() {
  const t = useT();
  const navigate = useNavigate();
  const host = useHost();
  const { cancelAllJobs } = useOfflineDownload();
  const [tab, setTab] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [listReloadNonce, setListReloadNonce] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const refreshTotalBytes = useCallback(() => {
    void host.offlineMedia.totalReadyBytes(null).then(setTotalBytes);
  }, [host]);

  useEffect(() => {
    let cancelled = false;
    void host.offlineMedia.totalReadyBytes(null).then((n) => {
      if (!cancelled) setTotalBytes(n);
    });
    return () => {
      cancelled = true;
    };
  }, [host, tab, listReloadNonce]);

  const storageLabel =
    totalBytes == null ? '…' : t('offline.storageUsed', { size: formatBytes(totalBytes) });

  const handleClearAll = useCallback(async () => {
    setClearBusy(true);
    try {
      cancelAllJobs();
      const keys = await host.offlineMedia.listReadyKeys(null);
      await Promise.all(keys.map((key) => host.offlineMedia.delete(key)));
      setListReloadNonce((n) => n + 1);
      refreshTotalBytes();
      setClearOpen(false);
    } finally {
      setClearBusy(false);
    }
  }, [cancelAllJobs, host, refreshTotalBytes]);

  return (
    <Box
      sx={{
        height: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky" sx={{ flexShrink: 0 }}>
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton edge="start" onClick={() => navigate('/')} />
          <Typography variant="subtitle1" component="h1" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>
            {t('offline.title')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {storageLabel}
          </Typography>
          <Tooltip title={t('offline.clearAll')}>
            <span>
              <IconButton
                edge="end"
                size="small"
                color="error"
                aria-label={t('offline.clearAll')}
                disabled={clearBusy || totalBytes == null || totalBytes === 0}
                onClick={() => setClearOpen(true)}
              >
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container
        maxWidth="md"
        sx={{
          ...libraryFlexFillSx,
          display: 'flex',
          flexDirection: 'column',
          py: 2.5,
          px: { xs: 2, sm: 3 },
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, flexShrink: 0 }}>
          <Tab label={t('offline.downloaded.tab')} id="dl-tab-0" aria-controls="dl-panel-0" />
          <Tab label={t('offline.downloading.tab')} id="dl-tab-1" aria-controls="dl-panel-1" />
        </Tabs>

        <Box
          role="tabpanel"
          hidden={tab !== 0}
          id="dl-panel-0"
          aria-labelledby="dl-tab-0"
          sx={{
            ...libraryFlexFillSx,
            display: tab === 0 ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {tab === 0 && <DownloadedSongListView reloadNonce={listReloadNonce} />}
        </Box>
        <Box
          role="tabpanel"
          hidden={tab !== 1}
          id="dl-panel-1"
          aria-labelledby="dl-tab-1"
          sx={{
            ...libraryFlexFillSx,
            display: tab === 1 ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          {tab === 1 && <DownloadingSongListView />}
        </Box>
      </Container>

      <Dialog open={clearOpen} onClose={() => !clearBusy && setClearOpen(false)}>
        <DialogTitle>{t('offline.clearAll.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t('offline.clearAll.confirmBody')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)} disabled={clearBusy}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" disabled={clearBusy} onClick={() => void handleClearAll()}>
            {clearBusy ? t('offline.clearAll.busy') : t('common.clear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
