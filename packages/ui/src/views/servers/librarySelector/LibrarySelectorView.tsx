import { useMemo } from 'react';
import { useI18n, useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  List,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useServerAndLibrary } from '@ui/contexts';
import {
  setServerLibraryRescanBeforeSyncEnabled,
  useServerLibraryRescanBeforeSyncEnabled,
} from '@ui/preferences/serverLibraryRescanBeforeSyncPreference';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import {
  SettingsPreferenceListItem,
  SettingsPreferenceRow,
  SettingsPreferenceRowLabel,
} from '@ui/views/settings/SettingsPreferenceRow';
import {
  SettingsListItemCaption,
  SettingsListItemTitle,
  SettingsPageDescription,
} from '@ui/views/settings/SettingsTypography';
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
  const rescanBeforeSync = useServerLibraryRescanBeforeSyncEnabled();
  const { rows, loadError, loading, servers } = useLibraryRows();
  const { refreshingKey, refreshError, setRefreshError, refreshLibraryRow } = useRefreshLibraryRow();
  const cacheStatsByRowKey = useLibraryRowCacheStats(rows, loading, refreshingKey);

  const activeCount = useMemo(() => activeLibraryRefs.length, [activeLibraryRefs]);

  return (
    <Box
      sx={
        embedded
          ? {
              ...libraryFlexFillSx,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxWidth: '100%',
            }
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
          ...(embedded
            ? {
                ...libraryFlexFillSx,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : undefined),
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
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

          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              mb: 2,
            }}
          >
            <List disablePadding>
              <SettingsPreferenceListItem>
                <SettingsPreferenceRow>
                  <SettingsPreferenceRowLabel>
                    <SettingsListItemTitle>
                      {t('settings.ux.rescanBeforeSync')}
                    </SettingsListItemTitle>
                    <SettingsListItemCaption>
                      {t('settings.ux.rescanBeforeSync.caption')}
                    </SettingsListItemCaption>
                  </SettingsPreferenceRowLabel>
                  <Switch
                    checked={rescanBeforeSync}
                    onChange={(_, c) => setServerLibraryRescanBeforeSyncEnabled(c)}
                    aria-label={t('settings.ux.rescanBeforeSync')}
                    sx={{ mt: 0.125, flexShrink: 0 }}
                  />
                </SettingsPreferenceRow>
              </SettingsPreferenceListItem>
            </List>
          </Paper>

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
        </Box>

        {servers.length > 0 && rows.length > 0 && (
          <Box
            sx={
              embedded
                ? {
                    ...libraryFlexFillSx,
                    overflow: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }
                : undefined
            }
          >
            <LibrarySelectorList
              rows={rows}
              cacheStatsByRowKey={cacheStatsByRowKey}
              refreshingKey={refreshingKey}
              refreshDisabledGlobal={refreshingKey !== null}
              onRefreshRow={(row) => void refreshLibraryRow(row)}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}
