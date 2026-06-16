import { useT } from '@asmusic/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Child } from 'subsonic-api';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrow from '@mui/icons-material/PlayArrow';
import MoreVert from '@mui/icons-material/MoreVert';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Shuffle from '@mui/icons-material/Shuffle';
import {
  Box,
  CircularProgress,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  coverArtIdFromAlbumsForCachedSong,
  isChildStarred,
  resolveLocalPlaylistEntries,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type LocalPlaylistEntry,
  type LocalPlaylistResolvedEntry,
  type SubsonicAPI,
} from '@asmusic/core';
import { PageCloseButton } from '../../../../shared/PageCloseButton';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { SongItem } from '../../../../shared/SongItem';
import type { PersistCachedArtwork } from '../../../../shared/libraryArtworkCacheAccess';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '../../../../shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '../../../../shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '../../../../shared/useLibraryVirtuosoScroller';
import { VirtuosoMuiList } from '../../../../shared/virtuosoMuiList';
import { useOfflineDownload } from '../../../../contexts/OfflineDownloadContext';
import { useHost } from '../../../../host/HostContext';
import { useServerAndLibrary } from '../../../../contexts';

type LocalPlaylistRow = LocalPlaylistResolvedEntry & { rowKey: string };

function rowMatchesQuery(row: LocalPlaylistRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (row.status === 'available') {
    const song = row.song;
    return (
      (song.title ?? '').toLowerCase().includes(q) ||
      (song.artist ?? '').toLowerCase().includes(q) ||
      (song.album ?? '').toLowerCase().includes(q)
    );
  }
  return (
    row.displayTitle.toLowerCase().includes(q) ||
    (row.displayArtist ?? '').toLowerCase().includes(q) ||
    (row.displayAlbum ?? '').toLowerCase().includes(q)
  );
}

export function LocalPlaylistSongListView({
  playlistId: _playlistId,
  scrollRestorationKey,
  playlistTitle,
  entries,
  songsByScope,
  albumsByScope,
  apiForServer,
  initialReady,
  syncing,
  resolveCachedArtworkForScope,
  persistCachedArtworkForScope,
  artworkVersionById,
  artworkVersionKey,
  onBack,
  onPlayResolvedRow,
  onPlayNextResolvedRow,
  onAppendResolvedRowToQueue,
  onAppendAllToQueue,
  onShufflePlayAll,
  onReplaceQueueAndPlayAll,
  onEditPlaylist,
  onDeletePlaylist,
  reloadToken,
  setTrackStarred,
}: {
  playlistId: string;
  scrollRestorationKey: string;
  playlistTitle: string;
  entries: LocalPlaylistEntry[];
  songsByScope: ReadonlyMap<string, Child[]>;
  albumsByScope: ReadonlyMap<string, ReturnType<typeof import('@asmusic/core').albumsFromCachedSongs>>;
  apiForServer: (serverId: string) => SubsonicAPI | null;
  initialReady: boolean;
  syncing: boolean;
  resolveCachedArtworkForScope: (scope: LibraryCacheScope, coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtworkForScope: (scope: LibraryCacheScope) => PersistCachedArtwork | undefined;
  artworkVersionById: Record<string, number>;
  artworkVersionKey: (coverArtId: string, sc: LibraryCacheScope) => string;
  onBack: () => void;
  onPlayResolvedRow: (row: LocalPlaylistResolvedEntry) => void;
  onPlayNextResolvedRow: (row: LocalPlaylistResolvedEntry) => void;
  onAppendResolvedRowToQueue: (row: LocalPlaylistResolvedEntry) => void;
  onAppendAllToQueue: () => void;
  onShufflePlayAll: () => void;
  onReplaceQueueAndPlayAll: () => void;
  onEditPlaylist?: () => void;
  onDeletePlaylist?: () => void;
  reloadToken?: number;
  setTrackStarred?: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
}) {
  const t = useT();
  const host = useHost();
  const { servers } = useServerAndLibrary();
  const { enqueuePlaylistDownload } = useOfflineDownload();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LocalPlaylistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const unavailableLabel = t('library.playlist.trackUnavailable');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const serverConfigs = servers.map((s) => ({
        id: s.id,
        serverUrl: s.serverUrl,
        username: s.username,
      }));
      const resolved = await resolveLocalPlaylistEntries({
        entries,
        songsByScope,
        libraryCache: host.libraryCache,
        servers: serverConfigs,
        unavailableLabel,
      });
      setRows(
        resolved.map((row) => ({
          ...row,
          rowKey: `${row.ref.serverKey}|${row.ref.libraryId}|${row.ref.trackId}|${row.sortIndex}`,
        }))
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load playlist');
    } finally {
      setLoading(false);
    }
  }, [entries, songsByScope, host.libraryCache, servers, unavailableLabel]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, reloadToken]);

  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesQuery(row, search)),
    [rows, search]
  );

  const scrollRef = useLibraryScrollRestoration(`lb:localPlaylistTracks:${scrollRestorationKey}`);
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [search]);

  const listReady = initialReady && !loading && !loadError;
  const queryTrimmed = search.trim();

  const onDownloadPlaylistOffline = useCallback(() => {
    const byScope = new Map<string, { serverId: string; libraryId: string; trackIds: string[] }>();
    for (const row of rows) {
      if (row.status !== 'available') continue;
      const key = `${row.serverId}|${row.libraryId}`;
      const existing = byScope.get(key);
      const trackId = String(row.song.id);
      if (existing) existing.trackIds.push(trackId);
      else byScope.set(key, { serverId: row.serverId, libraryId: row.libraryId, trackIds: [trackId] });
    }
    for (const group of byScope.values()) {
      enqueuePlaylistDownload({
        serverId: group.serverId,
        libraryId: group.libraryId,
        playlistTitle,
        trackIds: group.trackIds,
      });
    }
  }, [rows, enqueuePlaylistDownload, playlistTitle]);

  return (
    <Box
      role="tabpanel"
      id="library-panel-playlist-tracks"
      aria-labelledby="library-tab-playlists"
      sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Stack sx={{ flexShrink: 0, mb: 2, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <PageCloseButton edge="start" onClick={onBack} sx={{ alignSelf: 'flex-start' }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          {playlistTitle}
        </Typography>
        <Tooltip title={t('library.playlist.downloadOffline')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('library.playlist.downloadOffline')}
              onClick={onDownloadPlaylistOffline}
              disabled={!listReady || rows.filter((r) => r.status === 'available').length === 0}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {(onEditPlaylist || onDeletePlaylist) && (
          <>
            <IconButton
              size="small"
              color="inherit"
              aria-label={t('library.playlist.actions')}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {onEditPlaylist && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onEditPlaylist();
                  }}
                >
                  <ListItemText>{t('library.playlist.edit')}</ListItemText>
                </MenuItem>
              )}
              {onDeletePlaylist && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onDeletePlaylist();
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemText>{t('library.playlist.delete')}</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </Stack>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexShrink: 0, alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            {t('library.playlist.loading')}
          </Typography>
        </Stack>
      )}
      {loadError && (
        <Typography variant="body2" color="error" sx={{ mb: 2, flexShrink: 0 }}>
          {loadError}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, mb: 2, alignItems: 'center' }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.playlist.searchTracks')}
          aria-label={t('library.playlist.filterTracks')}
          fullWidth
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
          disabled={!listReady}
        />
        <Tooltip title={t('player.action.playAll')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('player.action.playAllSongs')}
              disabled={!listReady || filteredRows.length === 0}
              onClick={onReplaceQueueAndPlayAll}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('player.action.addAllToQueue')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('player.action.addAllToQueue')}
              disabled={!listReady || filteredRows.length === 0}
              onClick={onAppendAllToQueue}
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
              disabled={!listReady || filteredRows.length === 0}
              onClick={onShufflePlayAll}
            >
              <Shuffle fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {listReady && rows.length === 0 && !syncing && (
          <Typography variant="body2" color="text.secondary">
            {t('library.playlist.emptyLocal')}
          </Typography>
        )}
        {listReady && rows.length > 0 && filteredRows.length === 0 && queryTrimmed.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.playlist.noTracksMatch')}
          </Typography>
        )}
        {listReady && filteredRows.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%', width: '100%', minHeight: 0 }}
              data={filteredRows}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_index, row) => row?.rowKey ?? `lb-lpl-tr:${_index}`}
              itemContent={(_index, row) => {
                if (!row) return null;
                if (row.status === 'unavailable') {
                  return (
                    <SongItem
                      track={{
                        id: row.ref.trackId,
                        isDir: false,
                        title: row.displayTitle,
                        artist: row.displayArtist,
                        album: row.displayAlbum,
                        coverArt: row.ref.coverArtId,
                      }}
                      coverArtId={row.ref.coverArtId}
                      api={null}
                      resolveCachedArtwork={async () => null}
                      artworkCacheBump={0}
                      unavailable
                      includeAlbumInSecondary={false}
                      onClick={() => onPlayResolvedRow(row)}
                      onPlayNext={() => onPlayNextResolvedRow(row)}
                      onAppendToQueue={() => onAppendResolvedRowToQueue(row)}
                    />
                  );
                }
                const track = row.song;
                const albums = albumsByScope.get(`${row.scope.serverKey}|${row.scope.libraryId}`) ?? [];
                const coverArtId = coverArtIdFromAlbumsForCachedSong(track, albums);
                const api = apiForServer(row.serverId);
                const starred = isChildStarred(track);
                return (
                  <SongItem
                    track={track}
                    coverArtId={coverArtId}
                    api={api ?? null}
                    resolveCachedArtwork={(id) => resolveCachedArtworkForScope(row.scope, id)}
                    persistCachedArtwork={persistCachedArtworkForScope(row.scope)}
                    artworkCacheBump={
                      coverArtId ? artworkVersionById[artworkVersionKey(coverArtId, row.scope)] ?? 0 : 0
                    }
                    includeAlbumInSecondary={false}
                    onClick={() => onPlayResolvedRow(row)}
                    onPlayNext={() => onPlayNextResolvedRow(row)}
                    onAppendToQueue={() => onAppendResolvedRowToQueue(row)}
                    isStarred={setTrackStarred ? starred : undefined}
                    onToggleStar={
                      setTrackStarred
                        ? () =>
                            setTrackStarred({
                              serverId: row.serverId,
                              libraryId: row.libraryId,
                              trackId: String(track.id),
                              starred: !starred,
                            })
                        : undefined
                    }
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
