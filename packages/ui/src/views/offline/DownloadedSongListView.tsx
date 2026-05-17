import { useI18n, useT } from '@asmusic/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Child } from 'subsonic-api';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Shuffle from '@mui/icons-material/Shuffle';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '../../shared/LibraryVirtuosoFill';
import { VirtuosoMuiList } from '../../shared/virtuosoMuiList';
import {
  formatDuration,
  serverAccountKey,
  type LibraryCacheScope,
  type OfflineMediaKey,
  type SubsonicAPI,
} from '@asmusic/core';
import { useHost } from '../../host/HostContext';
import { usePlayerActions, useServerAndLibrary } from '../../contexts';
import { playerQueueItemFromChild } from '../../player/core/playerQueueItemFromChild';
import type { PlayerQueueItem } from '../../player/core/types';
import { SongItem } from '../../shared/SongItem';
import { formatBytes } from '../../utils/formatBytes';

type RowModel = {
  key: OfflineMediaKey;
  scope: LibraryCacheScope;
  track: Child;
  sizeLabel: string;
  stale: boolean;
  api: SubsonicAPI | null;
  queueItem: PlayerQueueItem | null;
};

function syntheticTrack(trackId: string): Child {
  return { id: trackId, title: trackId, isDir: false };
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
  const { servers, getApiForServer } = useServerAndLibrary();
  const { insertAfterCurrent, appendToQueue, replaceQueueAndPlay } = usePlayerActions();
  const [rows, setRows] = useState<RowModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const keys = await host.offlineMedia.listReadyKeys(null);
      const scopeCache = new Map<string, Child[]>();
      const next: RowModel[] = [];
      for (const key of keys) {
        const sk = `${key.scope.serverKey}|${key.scope.libraryId}`;
        let songs = scopeCache.get(sk);
        if (!songs) {
          songs = await host.libraryCache.readSongList(key.scope);
          scopeCache.set(sk, songs);
        }
        const child = songs.find((c) => String(c.id) === key.trackId);
        const track = child ?? syntheticTrack(key.trackId);
        const server = servers.find((x) => serverAccountKey(x.serverUrl, x.username) === key.scope.serverKey);
        const api = server ? await getApiForServer(server.id) : null;
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
        const st = await host.offlineMedia.getStatus(key);
        const size = st.byteLength ?? 0;
        next.push({
          key,
          scope: key.scope,
          track,
          sizeLabel: formatBytes(size),
          stale: !child,
          api,
          queueItem,
        });
      }
      next.sort((a, b) => (a.track.title ?? '').localeCompare(b.track.title ?? ''));
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('offline.downloaded.loadError'));
    } finally {
      setLoading(false);
    }
  }, [host, servers, getApiForServer, t]);

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
      const q = rows[rowIndex]?.queueItem;
      if (!q) return;
      void insertAfterCurrent([q], { playFirst: true });
    },
    [rows, insertAfterCurrent]
  );

  const playNextForRow = useCallback(
    (rowIndex: number) => {
      const q = rows[rowIndex]?.queueItem;
      if (!q) return;
      void insertAfterCurrent([q], { playFirst: false });
    },
    [rows, insertAfterCurrent]
  );

  const appendForRow = useCallback(
    (rowIndex: number) => {
      const q = rows[rowIndex]?.queueItem;
      if (!q) return;
      void appendToQueue([q]);
    },
    [rows, appendToQueue]
  );

  const appendableQueueItems = useMemo(() => {
    const out: PlayerQueueItem[] = [];
    for (const r of rows) {
      if (r.queueItem) out.push(r.queueItem);
    }
    return out;
  }, [rows]);

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
    return format.count(rows.length, { one: t('word.track'), other: t('word.tracks') });
  }, [loading, error, rows.length, t, format]);

  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
          {header}
        </Typography>
        <Tooltip title={t('player.action.addAllToQueue')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('player.action.addAllToQueue')}
              disabled={loading || !!error || appendableQueueItems.length === 0}
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
              disabled={loading || !!error || appendableQueueItems.length === 0}
              onClick={shufflePlayAllDownloaded}
            >
              <Shuffle fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {!loading && !error && rows.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              style={{ height: '100%', width: '100%', minHeight: 0 }}
              data={rows}
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
                    resolveCachedArtwork={(coverArtIdArg) =>
                      host.libraryCache.readArtworkBlob(r.scope, coverArtIdArg)
                    }
                    artworkCacheBump={0}
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
