import { useMemo } from 'react';
import { useI18n, useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useServerAndLibrary } from '@ui/contexts';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { SettingsPageDescription } from '@ui/views/settings/SettingsTypography';
import { LibrarySelectorList } from './LibrarySelectorList';
import { LibrarySelectorToolbar } from './LibrarySelectorToolbar';
import { useLibraryRowCacheStats } from './useLibraryRowCacheStats';
import { useLibraryRows } from './useLibraryRows';
import { useRefreshLibraryRow } from './useRefreshLibraryRow';
import type { LibrarySelectorViewProps } from './types';

export function LibrarySelectorView({ embedded = false }: LibrarySelectorViewProps) {
  const t = useT();
  const { format } = useI18n();
  const navigate = useNavigate();
  const { activeLibraryRefs } = useServerAndLibrary();
  const { rows, loadError, loading, servers } = useLibraryRows();
  const { refreshingKey, refreshError, setRefreshError, refreshLibraryRow } = useRefreshLibraryRow();
  const cacheStatsByRowKey = useLibraryRowCacheStats(rows, loading, refreshingKey);

  const activeCount = useMemo(() => activeLibraryRefs.length, [activeLibraryRefs]);

  return (
    <Box
      sx={
        embedded
          ? { minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }
          : {
              minHeight:
                'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
              bgcolor: 'background.default',
            }
      }
    >
      <Container
        maxWidth={embedded ? false : 'sm'}
        disableGutters={embedded}
        sx={{
          py: embedded ? 0 : 3,
          px: embedded ? 0 : undefined,
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {!embedded && (
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              {t('servers.libraries.title')}
            </Typography>
            <PageCloseButton edge="end" onClick={() => navigate('/')} />
          </Stack>
        )}
        <SettingsPageDescription>{t('servers.libraries.description')}</SettingsPageDescription>
        {!embedded && <LibrarySelectorToolbar />}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="body2">
            {activeCount === 1 ? (
              t('servers.libraries.activeCountOne')
            ) : (
              t('servers.libraries.activeCount', { count: format.number(activeCount) })
            )}
          </Typography>
        </Paper>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}
        {refreshError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRefreshError(null)}>
            {refreshError}
          </Alert>
        )}

        {loading && rows.length === 0 && (
          <Stack direction="row" spacing={1} sx={{ py: 2, alignItems: 'center' }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              {t('servers.libraries.loadingFolders')}
            </Typography>
          </Stack>
        )}

        {servers.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            {t('servers.libraries.addServerFirst')}
          </Typography>
        )}

        {servers.length > 0 && rows.length > 0 && (
          <LibrarySelectorList
            rows={rows}
            cacheStatsByRowKey={cacheStatsByRowKey}
            refreshingKey={refreshingKey}
            refreshDisabledGlobal={refreshingKey !== null}
            onRefreshRow={(row) => void refreshLibraryRow(row)}
          />
        )}
      </Container>
    </Box>
  );
}
