import { useT } from '@asmusic/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AlbumID3, Child } from 'subsonic-api';
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
  resolveCoverArtIdForCachedSong,
  isChildStarred,
  loadPlaylistTracks,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type SubsonicAPI,
} from '@asmusic/core';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { SongItem } from '@ui/shared/songItem';
import type { PersistCachedArtwork } from '@ui/shared/libraryArtworkCacheAccess';
import { songMatchesQuery } from '@ui/shared/songSearch';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '@ui/shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '@ui/shared/useLibraryVirtuosoScroller';
import { VirtuosoMuiList } from '@ui/shared/virtuosoMuiList';
import { useOfflineDownload } from '@ui/contexts/OfflineDownloadContext';
import { useHost } from '@ui/host/HostContext';

export function PlaylistSongListView({
  playlistId,
  scrollRestorationKey,
  playlistTitle,
  cachedSongs,
  albums,
  api,
  initialReady,
  syncing,
  resolveCachedArtwork,
  persistCachedArtwork,
  coverArtCacheBump,
  artworkCacheKeyFor,
  serverId,
  libraryId,
  scope,
  onBack,
  onPlayTrack,
  onPlayNextTrack,
  onAppendTrackToQueue,
  onAppendAllToQueue,
  onShufflePlayAll,
  onReplaceQueueAndPlayAll,
  onEditPlaylist,
  onDeletePlaylist,
  canEditPlaylist = true,
  setTrackStarred,
  reloadToken,
}: {
  playlistId: string;
  scrollRestorationKey: string;
  playlistTitle: string;
  cachedSongs: Child[];
  albums: AlbumID3[];
  api: SubsonicAPI;
  initialReady: boolean;
  syncing: boolean;
  resolveCachedArtwork: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  coverArtCacheBump?: (coverArtId: string | undefined) => number;
  artworkCacheKeyFor?: (coverArtId: string) => string;
  serverId: string;
  libraryId: string;
  scope: LibraryCacheScope;
  onBack: () => void;
  onPlayTrack?: (track: Child) => void;
  onPlayNextTrack?: (track: Child) => void;
  onAppendTrackToQueue?: (track: Child) => void;
  onAppendAllToQueue?: (tracks: Child[]) => void;
  onShufflePlayAll?: (tracks: Child[]) => void;
  onReplaceQueueAndPlayAll?: (tracks: Child[]) => void;
  onEditPlaylist?: () => void;
  onDeletePlaylist?: () => void;
  /** False when multiple libraries are active; edit adds songs to a server playlist. */
  canEditPlaylist?: boolean;
  /** Bump to refetch playlist tracks after editor save. */
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
  const { enqueuePlaylistDownload } = useOfflineDownload();
  const bumpFor = coverArtCacheBump ?? (() => 0);
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<Child[]>([]);
  const [resolvedTitle, setResolvedTitle] = useState(playlistTitle);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const loadPlaylist = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setTracks([]);
    try {
      const result = await loadPlaylistTracks({
        api,
        storage: host.libraryCache,
        scope,
        playlistId,
        playlistTitle,
        cachedSongs,
      });
      setResolvedTitle(result.title);
      setTracks(result.tracks);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load playlist');
    } finally {
      setLoading(false);
    }
  }, [api, host.libraryCache, scope, playlistId, cachedSongs, playlistTitle]);

  useEffect(() => {
    setSearch('');
    setResolvedTitle(playlistTitle);
  }, [playlistId, playlistTitle]);

  useEffect(() => {
    void loadPlaylist();
  }, [loadPlaylist, reloadToken]);

  const filteredTracks = useMemo(
    () => tracks.filter((t) => songMatchesQuery(t, search)),
    [tracks, search]
  );

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration(`lb:playlistTracks:${scrollRestorationKey}`);
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [search]);

  const listReady = initialReady && !loading && !loadError;

  const onDownloadPlaylistOffline = useCallback(() => {
    enqueuePlaylistDownload({
      serverId,
      libraryId,
      playlistTitle: resolvedTitle,
      trackIds: tracks.map((track) => String(track.id)),
    });
  }, [enqueuePlaylistDownload, serverId, libraryId, resolvedTitle, tracks]);

  return (
    <Box
      role="tabpanel"
      id="library-panel-playlist-tracks"
      aria-labelledby="library-tab-playlists"
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        sx={{
          flexShrink: 0,
          mb: 2,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <PageCloseButton edge="start" onClick={onBack} sx={{ alignSelf: 'flex-start' }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          {resolvedTitle}
        </Typography>
        <Tooltip title={t('library.playlist.downloadOffline')}>
          <span>
            <IconButton
              size="small"
              color="primary"
              aria-label={t('library.playlist.downloadOffline')}
              onClick={onDownloadPlaylistOffline}
              disabled={!listReady || tracks.length === 0}
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
                <Tooltip
                  title={!canEditPlaylist ? t('library.playlist.editDisabledMulti') : ''}
                  disableHoverListener={canEditPlaylist}
                >
                  <span>
                    <MenuItem
                      disabled={!canEditPlaylist}
                      onClick={() => {
                        if (!canEditPlaylist) return;
                        setMenuAnchor(null);
                        onEditPlaylist();
                      }}
                    >
                      <ListItemText>{t('library.playlist.edit')}</ListItemText>
                    </MenuItem>
                  </span>
                </Tooltip>
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

      <Stack
        direction="row"
        spacing={1}
        sx={{ flexShrink: 0, mb: 2, alignItems: 'center' }}
      >
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
        {onReplaceQueueAndPlayAll && (
          <Tooltip title={t('player.action.playAll')}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t('player.action.playAllSongs')}
                disabled={!listReady || filteredTracks.length === 0}
                onClick={() => onReplaceQueueAndPlayAll(filteredTracks)}
              >
                <PlayArrow fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {onAppendAllToQueue && (
          <Tooltip title={t('player.action.addAllToQueue')}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t('player.action.addAllToQueue')}
                disabled={!listReady || filteredTracks.length === 0}
                onClick={() => onAppendAllToQueue(filteredTracks)}
              >
                <PlaylistAdd fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {onShufflePlayAll && (
          <Tooltip title={t('player.action.shuffleAll')}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={t('player.action.shuffleAll')}
                disabled={!listReady || filteredTracks.length === 0}
                onClick={() => onShufflePlayAll(filteredTracks)}
              >
                <Shuffle fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {listReady && tracks.length === 0 && !syncing && (
          <Typography variant="body2" color="text.secondary">
            This playlist has no tracks.
          </Typography>
        )}
        {listReady && tracks.length > 0 && filteredTracks.length === 0 && queryTrimmed.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.playlist.noTracksMatch')}
          </Typography>
        )}
        {listReady && filteredTracks.length > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%', width: '100%', minHeight: 0 }}
              data={filteredTracks}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_index, track) =>
                track ? `lb-pl-tr:${playlistId}:${track.id}` : `lb-pl-tr:${_index}`
              }
              itemContent={(_index, track) => {
                if (!track) return null;
                const coverArtId = resolveCoverArtIdForCachedSong(track, albums);
                const starred = isChildStarred(track);
                return (
                  <SongItem
                    track={track}
                    coverArtId={coverArtId}
                    api={api}
                    resolveCachedArtwork={resolveCachedArtwork}
                    persistCachedArtwork={persistCachedArtwork}
                    artworkCacheBump={bumpFor(coverArtId)}
                    artworkCacheKey={
                      coverArtId && artworkCacheKeyFor ? artworkCacheKeyFor(coverArtId) : undefined
                    }
                    includeAlbumInSecondary={false}
                    onClick={onPlayTrack ? () => onPlayTrack(track) : undefined}
                    onPlayNext={onPlayNextTrack ? () => onPlayNextTrack(track) : undefined}
                    onAppendToQueue={
                      onAppendTrackToQueue ? () => onAppendTrackToQueue(track) : undefined
                    }
                    isStarred={setTrackStarred ? starred : undefined}
                    onToggleStar={
                      setTrackStarred
                        ? () =>
                            setTrackStarred({
                              serverId,
                              libraryId,
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
