import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useT, type I18nContextValue, type I18nFormatters } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Dns from '@mui/icons-material/Dns';
import Refresh from '@mui/icons-material/Refresh';
import {
  albumsFromCachedSongs,
  collectCoverArtIdsFromAlbums,
  DEFAULT_LIBRARY_ID,
  fetchMusicFolders,
  libraryCacheScope,
  refreshLibraryCache,
  runLibraryArtworkBackgroundCache,
  type MusicFolderSummary,
} from '@asmusic/core';
import { useServerAndLibrary, useLibraryBrowseCache } from '../../contexts';
import { PageCloseButton } from '../../shared/PageCloseButton';
import {
  SettingsListItemCaption,
  SettingsPageDescription,
} from '../settings/SettingsTypography';
import { useHost } from '../../host/HostContext';

export type LibrarySelectorViewProps = {
  embedded?: boolean;
};

function rowKey(row: { serverId: string; libraryId: string }): string {
  return `${row.serverId}:${row.libraryId}`;
}

type LibraryRow = {
  serverId: string;
  serverUrl: string;
  username: string;
  libraryId: string;
  libraryName: string;
};

type LibraryRowCacheStats = {
  albumCount: number;
  songCount: number;
  lastSyncAt: number | null;
};

function libraryRowStatsLines(
  stats: LibraryRowCacheStats | null | undefined,
  t: I18nContextValue['t'],
  format: I18nFormatters
): {
  counts: string;
  sync: string | null;
} {
  if (stats === undefined) {
    return { counts: t('servers.libraries.statsLoading'), sync: null };
  }
  if (stats === null) {
    return { counts: t('servers.libraries.statsError'), sync: null };
  }
  if (stats.lastSyncAt == null && stats.songCount === 0 && stats.albumCount === 0) {
    return { counts: t('servers.libraries.noCacheYet'), sync: null };
  }
  const counts = t('servers.libraries.counts', {
    albums: format.number(stats.albumCount),
    songs: format.number(stats.songCount),
  });
  const sync =
    stats.lastSyncAt == null
      ? t('servers.libraries.lastSyncNever')
      : t('servers.libraries.lastSync', {
          when: format.dateTime(new Date(stats.lastSyncAt)),
        });
  return { counts, sync };
}

export function LibrarySelectorView({ embedded = false }: LibrarySelectorViewProps) {
  const t = useT();
  const { format } = useI18n();
  const navigate = useNavigate();
  const host = useHost();
  const { servers, activeLibraryRefs, toggleActiveLibrary, isLibraryActive, getApiForServer } = useServerAndLibrary();
  const { reloadCachedSongsFromDisk } = useLibraryBrowseCache();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [cacheStatsByRowKey, setCacheStatsByRowKey] = useState<Record<string, LibraryRowCacheStats | null>>({});
  const artworkAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      artworkAbortRef.current?.abort();
    };
  }, []);

  const loadAll = useCallback(async () => {
    if (servers.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setCacheStatsByRowKey({});
    const next: LibraryRow[] = [];
    try {
      for (const s of servers) {
        const api = await getApiForServer(s.id);
        if (!api) {
          next.push({
            serverId: s.id,
            serverUrl: s.serverUrl,
            username: s.username,
            libraryId: 'unreachable',
            libraryName: t('servers.libraries.unreachable'),
          });
          continue;
        }
        let folders: MusicFolderSummary[];
        try {
          folders = await fetchMusicFolders(api);
        } catch {
          folders = [];
        }
        if (folders.length === 0) {
          next.push({
            serverId: s.id,
            serverUrl: s.serverUrl,
            username: s.username,
            libraryId: DEFAULT_LIBRARY_ID,
            libraryName: t('servers.defaultLibraryName'),
          });
          continue;
        }
        for (const f of folders) {
          next.push({
            serverId: s.id,
            serverUrl: s.serverUrl,
            username: s.username,
            libraryId: f.id,
            libraryName: f.name,
          });
        }
      }
      setRows(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('servers.error.loadLibraries'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [servers, getApiForServer, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (loading || servers.length === 0 || rows.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        rows.map(async (row): Promise<[string, LibraryRowCacheStats | null]> => {
          const rk = rowKey(row);
          if (row.libraryId === 'unreachable') {
            return [rk, null];
          }
          const server = servers.find((s) => s.id === row.serverId);
          if (!server) {
            return [rk, null];
          }
          const scope = libraryCacheScope(server.serverUrl, server.username, row.libraryId);
          try {
            const [meta, albumCount] = await Promise.all([
              host.libraryCache.readMeta(scope),
              host.libraryCache.readCachedAlbumCount(scope),
            ]);
            return [
              rk,
              {
                albumCount,
                songCount: meta?.songCount ?? 0,
                lastSyncAt: meta?.lastSyncAt ?? null,
              },
            ];
          } catch {
            return [rk, null];
          }
        })
      );
      if (!cancelled) {
        setCacheStatsByRowKey(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, rows, servers, host.libraryCache, refreshingKey]);

  const activeCount = useMemo(() => activeLibraryRefs.length, [activeLibraryRefs]);

  const refreshLibraryRow = useCallback(
    async (row: LibraryRow) => {
      if (row.libraryId === 'unreachable') return;
      const ref = { serverId: row.serverId, libraryId: row.libraryId };
      if (!isLibraryActive(ref)) return;
      const server = servers.find((s) => s.id === row.serverId);
      if (!server) return;

      const key = rowKey(row);
      setRefreshingKey(key);
      setRefreshError(null);
      artworkAbortRef.current?.abort();
      const ac = new AbortController();
      artworkAbortRef.current = ac;

      try {
        const api = await getApiForServer(row.serverId);
        if (!api) {
          throw new Error(t('servers.error.noSession', { url: row.serverUrl }));
        }
        const scope = libraryCacheScope(server.serverUrl, server.username, row.libraryId);
        const { songs } = await refreshLibraryCache(api, host.libraryCache, scope);
        const derivedAlbums = albumsFromCachedSongs(songs);
        const ids = collectCoverArtIdsFromAlbums(derivedAlbums);
        void runLibraryArtworkBackgroundCache(api, host.libraryCache, scope, ids, { signal: ac.signal });
        void reloadCachedSongsFromDisk();
      } catch (e) {
        setRefreshError(e instanceof Error ? e.message : t('servers.error.syncFailed'));
      } finally {
        setRefreshingKey(null);
      }
    },
    [getApiForServer, host.libraryCache, isLibraryActive, reloadCachedSongsFromDisk, servers, t]
  );

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth={embedded ? false : 'sm'} sx={{ py: embedded ? 0 : 3, px: embedded ? 0 : undefined }}>
        {!embedded && (
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              {t('servers.libraries.title')}
            </Typography>
            <PageCloseButton edge="end" onClick={() => navigate('/')} />
          </Stack>
        )}
        <SettingsPageDescription>{t('servers.libraries.description')}</SettingsPageDescription>
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          {!embedded && (
            <Tooltip title={t('servers.libraries.manageServers')}>
              <IconButton
                size="small"
                aria-label={t('servers.libraries.manageServers')}
                onClick={() => navigate('/settings/servers-libraries?tab=servers')}
              >
                <Dns fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('servers.libraries.reloadList')}>
            <span>
              <IconButton size="small" aria-label={t('servers.libraries.reloadList')} onClick={() => void loadAll()} disabled={loading}>
                <Refresh fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

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

        {loading && (
          <Stack direction="row" spacing={1} sx={{ py: 2, alignItems: 'center' }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              {t('servers.libraries.loadingFolders')}
            </Typography>
          </Stack>
        )}

        {!loading && servers.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('servers.libraries.addServerFirst')}
          </Typography>
        )}

        {!loading && servers.length > 0 && rows.length > 0 && (
          <List disablePadding>
            {rows.map((row) => {
              const disabled = row.libraryId === 'unreachable';
              const ref = { serverId: row.serverId, libraryId: row.libraryId };
              const checked = !disabled && isLibraryActive(ref);
              const rk = rowKey(row);
              const rowRefreshing = refreshingKey === rk;
              const refreshDisabled = disabled || !checked || refreshingKey !== null;
              const statsLines = libraryRowStatsLines(cacheStatsByRowKey[rk], t, format);
              return (
                <ListItem
                  key={rk}
                  disablePadding
                  divider
                  secondaryAction={
                    <Tooltip
                      title={
                        checked
                          ? t('servers.libraries.refresh')
                          : t('servers.libraries.activateToRefresh')
                      }
                    >
                      <span>
                        <IconButton
                          edge="end"
                          aria-label={t('servers.libraries.refreshAria', { name: row.libraryName })}
                          disabled={refreshDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void refreshLibraryRow(row);
                          }}
                          sx={{ mt: 0.5 }}
                        >
                          {rowRefreshing ? <CircularProgress size={20} color="inherit" /> : <Refresh sx={{ fontSize: 20 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                >
                  <ListItemButton
                    disabled={disabled}
                    onClick={() => !disabled && toggleActiveLibrary(ref)}
                    sx={{ alignItems: 'flex-start', pr: 7 }}
                  >
                    <ListItemIcon sx={{ minWidth: 42, mt: 0.5 }}>
                      <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple disabled={disabled} />
                    </ListItemIcon>
                    <ListItemText
                      primary={row.libraryName}
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block' }}>
                            {row.username} ·{' '}
                            <Box component="span" sx={{ wordBreak: 'break-all' }}>
                              {row.serverUrl}
                            </Box>
                          </Box>
                          {!disabled && (
                            <Box sx={{ mt: 0.5 }}>
                              <SettingsListItemCaption
                                component="span"
                                sx={{ mt: 0, lineHeight: 1.4 }}
                              >
                                {statsLines.counts}
                              </SettingsListItemCaption>
                              {statsLines.sync != null && (
                                <SettingsListItemCaption
                                  component="span"
                                  sx={{ mt: 0.25, lineHeight: 1.4 }}
                                >
                                  {statsLines.sync}
                                </SettingsListItemCaption>
                              )}
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Container>
    </Box>
  );
}
