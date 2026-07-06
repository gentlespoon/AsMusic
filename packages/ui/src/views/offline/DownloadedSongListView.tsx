import { useI18n, useT } from '@asmusic/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Child } from 'subsonic-api';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Shuffle from '@mui/icons-material/Shuffle';
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { VirtuosoMuiList } from '@ui/shared/virtuosoMuiList';
import {
  formatDuration,
  serverAccountKey,
  type LibraryCacheScope,
  type OfflineMediaKey,
  type SubsonicAPI,
} from '@asmusic/core';
import { useHost } from '@ui/host/HostContext';
import { useActiveLibraryScopes, useLibraryBrowseCache, usePlayerActions, useServerAndLibrary } from '@ui/contexts';
import { playerQueueItemFromChild } from '@ui/player/core/playerQueueItemFromChild';
import type { PlayerQueueItem } from '@ui/player/core/types';
import { SongItem } from '@ui/shared/songItem';
import { createPersistCachedArtworkForScope } from '@ui/shared/libraryArtworkCacheAccess';
import { createResolveCachedArtwork } from '@ui/shared/createResolveCachedArtwork';
import { songMatchesQuery } from '@ui/shared/songSearch';
import { formatBytes } from '@ui/utils/formatBytes';

type RowModel = {
  key: OfflineMediaKey;
  scope: LibraryCacheScope;
  track: Child;
  sizeLabel: string;
  stale: boolean;
  api: SubsonicAPI | null;
  queueItem: PlayerQueueItem | null;
  serverUrl?: string;
  username?: string;
};

function syntheticTrack(trackId: string): Child {
  return { id: trackId, title: trackId, isDir: false };
}

function scopeKey(scope: LibraryCacheScope): string {
  return `${scope.serverKey}|${scope.libraryId}`;
}

function trackLookupKey(scope: LibraryCacheScope, trackId: string): string {
  return `${scopeKey(scope)}|${trackId}`;
}

function shuffleCopy<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export type DownloadedSongListViewProps = {
  /** Increment to reload the list after bulk changes (e.g. clear all downloads). */
  reloadNonce?: number;
};

export function DownloadedSongListView({ reloadNonce = 0 }: DownloadedSongListViewProps) {
  const t = useT();
  const { format } = useI18n();
  const host = useHost();
  const activeScopes = useActiveLibraryScopes();
  const { slices, apiForServer } = useLibraryBrowseCache();
  const { servers } = useServerAndLibrary();
  const { insertAfterCurrent, appendToQueue, replaceQueueAndPlay } = usePlayerActions();
  const [rows, setRows] = useState<RowModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(
    () => rows.filter((r) => songMatchesQuery(r.track, search)),
    [rows, search]
  );
  const queryTrimmed = search.trim();

  const serverLabelForKey = useCallback(
    (scope: LibraryCacheScope) => {
      const s = servers.find((x) => serverAccountKey(x.serverUrl, x.username) === scope.serverKey);
      return s ? `${s.serverUrl} · ${s.username}` : scope.serverKey;
    },
    [servers]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeScopeIds = new Set(activeScopes.map((scope) => scopeKey(scope)));
      const entryLists = await Promise.all(
        activeScopes.map((scope) => host.offlineMedia.listReadyEntries(scope))
      );
      const entries = entryLists.flat().filter((entry) => activeScopeIds.has(scopeKey(entry.key.scope)));

      const trackByKey = new Map<string, Child>();
      const apiByScopeKey = new Map<string, SubsonicAPI | null>();
      const loadedScopeKeys = new Set<string>();

      for (const slice of slices) {
        const sk = scopeKey(slice.scope);
        loadedScopeKeys.add(sk);
        for (const song of slice.songs) {
          trackByKey.set(trackLookupKey(slice.scope, String(song.id)), song);
        }
        apiByScopeKey.set(sk, apiForServer(slice.serverId));
      }

      const scopesNeedingDisk = activeScopes.filter((scope) => !loadedScopeKeys.has(scopeKey(scope)));
      if (scopesNeedingDisk.length > 0) {
        await Promise.all(
          scopesNeedingDisk.map(async (scope) => {
            const sk = scopeKey(scope);
            const songs = await host.libraryCache.readSongList(scope);
            for (const song of songs) {
              trackByKey.set(trackLookupKey(scope, String(song.id)), song);
            }
            const server = servers.find(
              (x) => serverAccountKey(x.serverUrl, x.username) === scope.serverKey
            );
            apiByScopeKey.set(sk, server ? apiForServer(server.id) : null);
          })
        );
      }

      const serverByScopeKey = new Map<string, (typeof servers)[number]>();
      for (const server of servers) {
        for (const scope of activeScopes) {
          if (serverAccountKey(server.serverUrl, server.username) === scope.serverKey) {
            serverByScopeKey.set(scopeKey(scope), server);
          }
        }
      }

      const next: RowModel[] = entries.map(({ key, byteLength }) => {
        const sk = scopeKey(key.scope);
        const child = trackByKey.get(trackLookupKey(key.scope, key.trackId));
        const track = child ?? syntheticTrack(key.trackId);
        const server = serverByScopeKey.get(sk);
        const api = apiByScopeKey.get(sk) ?? null;
        const queueItem =
          server != null
            ? playerQueueItemFromChild({
                song: track,
                serverId: server.id,
                libraryId: key.scope.libraryId,
                serverUrl: server.serverUrl.replace(/\/$/, ''),
                username: server.username,
              })
            : null;
        return {
          key,
          scope: key.scope,
          track,
          sizeLabel: formatBytes(byteLength),
          stale: !child,
          api,
          queueItem,
          serverUrl: server?.serverUrl,
          username: server?.username,
        };
      });
      next.sort((a, b) => (a.track.title ?? '').localeCompare(b.track.title ?? ''));
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('offline.downloaded.loadError'));
    } finally {
      setLoading(false);
    }
  }, [host, activeScopes, slices, apiForServer, servers, t]);

  useEffect(() => {
    void load();
  }, [load, reloadNonce]);

  const onDelete = useCallback(
    async (key: OfflineMediaKey) => {
      await host.offlineMedia.delete(key);
      void load();
    },
    [host, load]
  );

  const playRowNow = useCallback(
    (rowIndex: number) => {
      const q = filteredRows[rowIndex]?.queueItem;
      if (!q) return;
      void insertAfterCurrent([q], { playFirst: true });
    },
    [filteredRows, insertAfterCurrent]
  );

  const playNextForRow = useCallback(
    (rowIndex: number) => {
      const q = filteredRows[rowIndex]?.queueItem;
      if (!q) return;
      void insertAfterCurrent([q], { playFirst: false });
    },
    [filteredRows, insertAfterCurrent]
  );

  const appendForRow = useCallback(
    (rowIndex: number) => {
      const q = filteredRows[rowIndex]?.queueItem;
      if (!q) return;
      void appendToQueue([q]);
    },
    [filteredRows, appendToQueue]
  );

  const appendableQueueItems = useMemo(() => {
    const out: PlayerQueueItem[] = [];
    for (const r of filteredRows) {
      if (r.queueItem) out.push(r.queueItem);
    }
    return out;
  }, [filteredRows]);

  const appendAllDownloadedToQueue = useCallback(() => {
    if (appendableQueueItems.length === 0) return;
    void appendToQueue(appendableQueueItems);
  }, [appendableQueueItems, appendToQueue]);

  const shufflePlayAllDownloaded = useCallback(() => {
    if (appendableQueueItems.length === 0) return;
    void replaceQueueAndPlay(shuffleCopy(appendableQueueItems), 0);
  }, [appendableQueueItems, replaceQueueAndPlay]);

  const header = useMemo(() => {
    if (loading) return t('offline.downloaded.loading');
    if (error) return error;
    if (rows.length === 0) return t('offline.downloaded.empty');
    const count = queryTrimmed.length > 0 ? filteredRows.length : rows.length;
    return format.count(count, { one: t('word.track'), other: t('word.tracks') });
  }, [loading, error, rows.length, filteredRows.length, queryTrimmed, t, format]);

  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
        {header}
      </Typography>

      {!loading && !error && rows.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, mb: 2, alignItems: 'center' }}
        >
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('offline.downloaded.search')}
            aria-label={t('offline.downloaded.filter')}
            fullWidth
            size="small"
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Tooltip title={t('player.action.addAllToQueue')}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t('player.action.addAllToQueue')}
                disabled={appendableQueueItems.length === 0}
                onClick={appendAllDownloadedToQueue}
              >
                <PlaylistAdd fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('player.action.shuffleAll')}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t('player.action.shuffleAll')}
                disabled={appendableQueueItems.length === 0}
                onClick={shufflePlayAllDownloaded}
              >
                <Shuffle fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {!loading &&
          !error &&
          rows.length > 0 &&
          filteredRows.length === 0 &&
          queryTrimmed.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('offline.downloaded.noMatch')}
            </Typography>
          )}
        {!loading && !error && filteredRows.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              style={{ height: '100%', width: '100%', minHeight: 0 }}
              data={filteredRows}
              components={{ List: VirtuosoMuiList }}
              computeItemKey={(_, r) =>
                `${r.key.scope.serverKey}|${r.key.scope.libraryId}|${r.key.trackId}|${r.key.variant ?? ''}`
              }
              itemContent={(rowIndex, r) => {
                const coverArtId = r.track.coverArt?.trim() || undefined;
                const baseLine =
                  [r.track.artist, r.track.album].filter(Boolean).join(' · ') || serverLabelForKey(r.scope);
                const dur =
                  r.track.duration != null && r.track.duration > 0
                    ? ` · ${formatDuration(r.track.duration)}`
                    : '';
                const secondaryContent = (
                  <>
                    {r.stale && (
                      <Typography component="span" variant="caption" color="warning.main" sx={{ display: 'block' }}>
                        Not in current library cache
                      </Typography>
                    )}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {baseLine}
                      {dur} · {r.sizeLabel}
                    </Typography>
                  </>
                );
                return (
                  <SongItem
                    track={r.track}
                    coverArtId={coverArtId}
                    api={r.api}
                    resolveCachedArtwork={(coverArtIdArg) => {
                      if (r.serverUrl && r.username) {
                        return createResolveCachedArtwork(
                          host.libraryCache,
                          r.serverUrl,
                          r.username,
                          r.scope.libraryId,
                        )(coverArtIdArg);
                      }
                      return host.libraryCache.readArtworkBlob(r.scope, coverArtIdArg);
                    }}
                    resolveArtworkLocalFile={
                      host.libraryCache.readArtworkLocalFile
                        ? (coverArtIdArg) =>
                            host.libraryCache.readArtworkLocalFile!(r.scope, coverArtIdArg)
                        : undefined
                    }
                    persistCachedArtwork={createPersistCachedArtworkForScope(host.libraryCache, r.scope)}
                    artworkCacheBump={0}
                    artworkCacheKey={scopeKey(r.scope)}
                    includeAlbumInSecondary
                    secondaryContent={secondaryContent}
                    showRemoveButton
                    onRemove={() => void onDelete(r.key)}
                    onClick={() => playRowNow(rowIndex)}
                    onPlayNext={() => playNextForRow(rowIndex)}
                    onAppendToQueue={() => appendForRow(rowIndex)}
                  />
                );
              }}
            />
          </LibraryVirtuosoFill>
        )}
      </Box>
    </Box>
  );
}
