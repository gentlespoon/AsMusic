import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useI18n, useT } from '@asmusic/i18n';
import { Alert, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  albumsFromCachedSongs,
  albumsFromCachedSongsForArtist,
  cachedSongsForArtistSorted,
  songsInCachedAlbum,
  type LibraryCacheScope,
  type LibraryRefreshProgress,
} from '@asmusic/core';
import { AlbumListView } from './catalog/AlbumListView';
import { ArtistListView } from './catalog/ArtistListView';
import { SongListView } from './catalog/SongListView';
import { AlbumSongListView } from './detail/AlbumSongListView';
import { ArtistAlbumListView } from './detail/ArtistAlbumListView';
import { ArtistAllSongListView } from './detail/ArtistAllSongListView';
import { PlaylistEditorView } from './detail/PlaylistEditorView';
import { PlaylistSongListView } from './detail/PlaylistSongListView';
import { PlaylistListView } from './playlists/PlaylistListView';
import { useHost } from '../../../host/HostContext';
import { useLibraryBrowseCache } from '../../../contexts';
import { createPersistCachedArtworkForScope } from '../../../shared/libraryArtworkCacheAccess';
import { ActiveScopeGate } from './browser/ActiveScopeGate';
import {
  defaultLibraryBrowserView,
  mergeLibraryBrowserSearchParams,
  parseLibraryBrowserView,
  encodeLibraryBrowserRef,
} from './browser/libraryNavigationUrl';
import { useLibraryBrowserResolvedScopes } from './browser/useLibraryBrowserResolvedScopes';
import { useLibraryBrowserTabBar } from './browser/useLibraryBrowserTabBar';
import { useLibraryBrowserPlayback } from './browser/useLibraryBrowserPlayback';
import {
  LibraryBrowserPlaylistDeleteDialog,
  useLibraryBrowserPlaylists,
} from './browser/useLibraryBrowserPlaylists';
import type { AlbumCatalogRow } from './catalog/AlbumListView';
import type { ArtistCatalogRow } from './catalog/ArtistListView';
import type { PlaylistCatalogRow } from '../../../contexts/LibraryBrowseCacheContext';
import { libraryFlexFillSx } from '../../../shared/LibraryVirtuosoFill';

export function LibraryBrowser() {
  const t = useT();
  const { format } = useI18n();
  const host = useHost();
  const navigate = useNavigate();

  const progressLabel = useCallback(
    (p: LibraryRefreshProgress | null): string | null => {
      if (!p) return null;
      if (p.phase === 'fetch') {
        return t('library.sync.fetching', { loaded: format.number(p.loaded) });
      }
      if (p.phase === 'write') {
        return t('library.sync.saving', { written: format.number(p.written) });
      }
      return t('library.sync.updatingPlaylists');
    },
    [t, format]
  );
  const { searchParams, setSearchParams, view } = useLibraryBrowserTabBar();
  const {
    scopesToLoad,
    scopesKey,
    slices,
    multiLibrary,
    singleSlice,
    albums,
    albumCatalogRows,
    artistCatalogRows,
    songEntriesSorted,
    favoriteSongEntriesSorted,
    playlistCatalogRows,
    initialReady,
    cacheReadError,
    syncing,
    syncError,
    syncProgress,
    apiForServer,
    artworkVersionById,
    artworkVersionKey,
    notifyArtworkCached,
    setTrackStarred,
  } = useLibraryBrowseCache();

  const searchKey = searchParams.toString();
  const { tab, album: albumSongScope, artist: artistAlbumScope, playlist: playlistScope } = view;

  const resolveCachedArtworkForScope = useCallback(
    (sc: LibraryCacheScope, coverArtId: string) => host.libraryCache.readArtworkBlob(sc, coverArtId),
    [host.libraryCache]
  );

  const resolveCachedArtwork = useCallback(
    (coverArtId: string, sc: LibraryCacheScope) => resolveCachedArtworkForScope(sc, coverArtId),
    [resolveCachedArtworkForScope]
  );

  const persistCachedArtworkForScope = useCallback(
    (sc: LibraryCacheScope) =>
      createPersistCachedArtworkForScope(host.libraryCache, sc, {
        onCached: (coverArtId) => notifyArtworkCached(artworkVersionKey(coverArtId, sc)),
      }),
    [host.libraryCache, notifyArtworkCached, artworkVersionKey]
  );

  const libraryScopeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (scopesToLoad.length === 0) return;
    const prev = libraryScopeKeyRef.current;
    const scopeChanged = prev !== null && prev !== scopesKey;
    libraryScopeKeyRef.current = scopesKey;

    if (scopeChanged) {
      setSearchParams(
        (prev) => mergeLibraryBrowserSearchParams(new URLSearchParams(prev), defaultLibraryBrowserView),
        { replace: true }
      );
      return;
    }

    if (searchParams.has('serverId') || searchParams.has('libraryId')) {
      const view = parseLibraryBrowserView(searchParams);
      setSearchParams((prev) => mergeLibraryBrowserSearchParams(new URLSearchParams(prev), view), {
        replace: true,
      });
    }
  }, [scopesKey, scopesToLoad.length, searchParams, setSearchParams, searchKey]);

  const { resolvedAlbum, resolvedArtist, resolvedPlaylist } = useLibraryBrowserResolvedScopes({
    albumScope: albumSongScope,
    artistScope: artistAlbumScope,
    playlistScope,
    slices,
    singleSlice,
  });

  const {
    playSongEntryNow,
    playTrackNow,
    playNextForSongEntry,
    appendForSongEntry,
    playNextForTrack,
    appendForTrack,
    appendAllSongEntriesToQueue,
    shufflePlayAllSongEntries,
    appendAllAlbumTracksToQueue,
    shufflePlayAllAlbumTracks,
    appendAllArtistTracksToQueue,
    shufflePlayAllArtistTracks,
    appendAllPlaylistTracksToQueue,
    shufflePlayAllPlaylistTracks,
    replaceQueueAndPlayAllPlaylistTracks,
  } = useLibraryBrowserPlayback({ resolvedAlbum, resolvedArtist, resolvedPlaylist });

  const openAlbum = useCallback(
    (row: AlbumCatalogRow) => {
      const albumUrlId = multiLibrary
        ? encodeLibraryBrowserRef({
            serverKey: row.artworkScope.serverKey,
            libraryId: row.artworkScope.libraryId,
            id: row.album.id,
          })
        : row.album.id;
      setSearchParams(
        (prev) =>
          mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
            tab: 'songs',
            album: { id: albumUrlId },
            artist: null,
            playlist: null,
          }),
        { replace: false }
      );
    },
    [multiLibrary, setSearchParams]
  );

  const popAlbumView = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const openArtist = useCallback(
    (row: ArtistCatalogRow) => {
      const artistUrlId = multiLibrary
        ? encodeLibraryBrowserRef({
            serverKey: row.artworkScope.serverKey,
            libraryId: row.artworkScope.libraryId,
            id: row.artist.id,
          })
        : row.artist.id;
      setSearchParams(
        (prev) =>
          mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
            tab: 'albums',
            album: null,
            artist: { id: artistUrlId, name: row.artist.name ?? artistUrlId, allSongs: false },
            playlist: null,
          }),
        { replace: false }
      );
    },
    [multiLibrary, setSearchParams]
  );

  const popArtistView = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const openPlaylist = useCallback(
    (row: PlaylistCatalogRow) => {
      const playlistUrlId = multiLibrary
        ? encodeLibraryBrowserRef({
            serverKey: row.artworkScope.serverKey,
            libraryId: row.artworkScope.libraryId,
            id: row.playlist.id,
          })
        : row.playlist.id;
      setSearchParams(
        (prev) =>
          mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
            tab: 'playlists',
            album: null,
            artist: null,
            playlist: { id: playlistUrlId, name: row.playlist.name },
          }),
        { replace: false }
      );
    },
    [multiLibrary, setSearchParams]
  );

  const popPlaylistView = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const openArtistAllSongs = useCallback(() => {
    if (!artistAlbumScope) return;
    setSearchParams(
      (prev) =>
        mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
          tab: 'songs',
          album: null,
          artist: {
            id: artistAlbumScope.id,
            name: artistAlbumScope.name,
            allSongs: true,
          },
          playlist: null,
        }),
      { replace: false }
    );
  }, [artistAlbumScope, setSearchParams]);

  const albumScopeTracks = useMemo(() => {
    if (!resolvedAlbum) return [];
    return songsInCachedAlbum(resolvedAlbum.subsonicAlbumId, resolvedAlbum.slice.songs);
  }, [resolvedAlbum]);

  const artistScopeAlbums = useMemo(() => {
    if (!resolvedArtist) return [];
    return albumsFromCachedSongsForArtist(resolvedArtist.subsonicArtistId, resolvedArtist.slice.songs);
  }, [resolvedArtist]);

  const artistScopeTracks = useMemo(() => {
    if (!resolvedArtist) return [];
    return cachedSongsForArtistSorted(resolvedArtist.subsonicArtistId, resolvedArtist.slice.songs);
  }, [resolvedArtist]);

  const albumHeaderTitle = useMemo(() => {
    if (!resolvedAlbum) return '';
    const sliceAlbums = albumsFromCachedSongs(resolvedAlbum.slice.songs);
    const match = sliceAlbums.find((a) => a.id === resolvedAlbum.subsonicAlbumId);
    return match?.name ?? resolvedAlbum.subsonicAlbumId;
  }, [resolvedAlbum]);

  const albumDetailApi = resolvedAlbum ? apiForServer(resolvedAlbum.slice.serverId) : null;
  const artistDetailApi = resolvedArtist ? apiForServer(resolvedArtist.slice.serverId) : null;
  const playlistDetailApi = resolvedPlaylist ? apiForServer(resolvedPlaylist.slice.serverId) : null;

  const playlistHeaderTitle = useMemo(() => {
    if (!playlistScope) return '';
    if (resolvedPlaylist?.summary?.name) return resolvedPlaylist.summary.name;
    return playlistScope.name;
  }, [playlistScope, resolvedPlaylist]);

  const {
    playlistEditorTarget,
    playlistDetailReloadToken,
    canCreatePlaylist,
    handleCreatePlaylist,
    handleDeletePlaylistRow,
    closePlaylistEditor,
    openPlaylistEditor,
    savePlaylistEditor,
    requestDeletePlaylist,
    deletePlaylistDialogProps,
  } = useLibraryBrowserPlaylists({
    scopesCount: scopesToLoad.length,
    singleSlice,
    resolvedPlaylist,
    playlistHeaderTitle,
    playlistDetailApi,
    onAfterPlaylistDeleted: popPlaylistView,
  });

  return (
    <ActiveScopeGate>
      <Box
        component="section"
        aria-label={t('library.album.ariaSection')}
        sx={{
          pt: 2,
          ...libraryFlexFillSx,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      {cacheReadError && (
        <Alert severity="error" sx={{ mb: 1.5, flexShrink: 0 }}>
          {cacheReadError}
        </Alert>
      )}
      {syncError && (
        <Alert severity="error" sx={{ mb: 1.5, flexShrink: 0 }}>
          {syncError}
        </Alert>
      )}
      {syncing && syncProgress && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flexShrink: 0 }}>
          {progressLabel(syncProgress)}
        </Typography>
      )}

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'albums' &&
          (artistAlbumScope && !artistAlbumScope.allSongs && resolvedArtist && artistDetailApi ? (
            <ArtistAlbumListView
              artistName={artistAlbumScope.name}
              scrollRestorationKey={artistAlbumScope.id}
              allSongsTrackCount={artistScopeTracks.length}
              albums={artistScopeAlbums}
              api={artistDetailApi}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={(id) => resolveCachedArtworkForScope(resolvedArtist.slice.scope, id)}
              persistCachedArtwork={persistCachedArtworkForScope(resolvedArtist.slice.scope)}
              artworkVersionById={artworkVersionById}
              coverArtCacheBump={(id) =>
                id ? artworkVersionById[artworkVersionKey(id, resolvedArtist.slice.scope)] ?? 0 : 0
              }
              onAlbumOpen={(album) =>
                openAlbum({
                  album,
                  serverId: resolvedArtist.slice.serverId,
                  artworkScope: resolvedArtist.slice.scope,
                })
              }
              onAllSongsOpen={openArtistAllSongs}
              onBack={popArtistView}
            />
          ) : artistAlbumScope && !artistAlbumScope.allSongs ? (
            <Typography variant="body2" color="text.secondary">
              {t('library.linkMismatch.artist')}
            </Typography>
          ) : (
            <AlbumListView
              rows={albumCatalogRows}
              apiForServer={apiForServer}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtworkForScope={resolveCachedArtworkForScope}
              persistCachedArtworkForScope={persistCachedArtworkForScope}
              artworkVersionKey={artworkVersionKey}
              artworkVersionById={artworkVersionById}
              onAlbumOpen={openAlbum}
            />
          ))}

        {tab === 'artists' && (
          <ArtistListView
            rows={artistCatalogRows}
            initialReady={initialReady}
            syncing={syncing}
            onArtistOpen={openArtist}
          />
        )}

        {tab === 'playlists' &&
          (playlistEditorTarget ? (
            <PlaylistEditorView
              playlistId={playlistEditorTarget.playlistId}
              playlistName={playlistEditorTarget.playlistName}
              cachedSongs={playlistEditorTarget.cachedSongs}
              api={playlistEditorTarget.api}
              onBack={closePlaylistEditor}
              onSave={savePlaylistEditor}
            />
          ) : playlistScope && resolvedPlaylist && playlistDetailApi ? (
            <PlaylistSongListView
              playlistId={resolvedPlaylist.subsonicPlaylistId}
              scrollRestorationKey={playlistScope.id}
              playlistTitle={playlistHeaderTitle}
              cachedSongs={resolvedPlaylist.slice.songs}
              albums={albumsFromCachedSongs(resolvedPlaylist.slice.songs)}
              api={playlistDetailApi}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={(id) => resolveCachedArtworkForScope(resolvedPlaylist.slice.scope, id)}
              persistCachedArtwork={persistCachedArtworkForScope(resolvedPlaylist.slice.scope)}
              artworkVersionById={artworkVersionById}
              coverArtCacheBump={(id) =>
                id ? artworkVersionById[artworkVersionKey(id, resolvedPlaylist.slice.scope)] ?? 0 : 0
              }
              serverId={resolvedPlaylist.slice.serverId}
              libraryId={resolvedPlaylist.slice.libraryId}
              onBack={popPlaylistView}
              onPlayTrack={(t) => playTrackNow(resolvedPlaylist.slice.serverId, resolvedPlaylist.slice.libraryId, t)}
              onPlayNextTrack={(t) => playNextForTrack(resolvedPlaylist.slice.serverId, resolvedPlaylist.slice.libraryId, t)}
              onAppendTrackToQueue={(t) => appendForTrack(resolvedPlaylist.slice.serverId, resolvedPlaylist.slice.libraryId, t)}
              onAppendAllToQueue={appendAllPlaylistTracksToQueue}
              onShufflePlayAll={shufflePlayAllPlaylistTracks}
              onReplaceQueueAndPlayAll={replaceQueueAndPlayAllPlaylistTracks}
              reloadToken={playlistDetailReloadToken}
              onEditPlaylist={openPlaylistEditor}
              canEditPlaylist={canCreatePlaylist}
              onDeletePlaylist={requestDeletePlaylist}
              setTrackStarred={setTrackStarred}
            />
          ) : playlistScope ? (
            <Typography variant="body2" color="text.secondary">
              {t('library.linkMismatch.playlist')}
            </Typography>
          ) : (
            <PlaylistListView
              rows={playlistCatalogRows}
              multiLibrary={multiLibrary}
              initialReady={initialReady}
              syncing={syncing}
              canCreatePlaylist={canCreatePlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylistRow}
              onPlaylistOpen={openPlaylist}
            />
          ))}

        {tab === 'favorites' && (
          <SongListView
            entries={favoriteSongEntriesSorted}
            albums={albums}
            apiForServer={apiForServer}
            initialReady={initialReady}
            syncing={syncing}
            resolveCachedArtwork={resolveCachedArtwork}
            persistCachedArtworkForScope={persistCachedArtworkForScope}
            artworkVersionKey={artworkVersionKey}
            artworkVersionById={artworkVersionById}
            scrollRestorationKey="lb:favorites"
            panelId="library-panel-favorites"
            ariaLabelledBy="library-tab-favorites"
            searchPlaceholder={t('library.favorites.search')}
            emptyListMessage={t('library.favorites.empty')}
            noSearchMatchMessage={t('library.favorites.noMatch')}
            onPlaySong={playSongEntryNow}
            onPlayNextSong={playNextForSongEntry}
            onAppendSongToQueue={appendForSongEntry}
            onAppendAllToQueue={appendAllSongEntriesToQueue}
            onShufflePlayAll={shufflePlayAllSongEntries}
            setTrackStarred={setTrackStarred}
          />
        )}

        {tab === 'songs' &&
          (albumSongScope && resolvedAlbum && albumDetailApi ? (
            <AlbumSongListView
              albumId={albumSongScope.id}
              scrollRestorationKey={albumSongScope.id}
              albumTitle={albumHeaderTitle}
              tracks={albumScopeTracks}
              albums={albumsFromCachedSongs(resolvedAlbum.slice.songs)}
              api={albumDetailApi}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={(id) => resolveCachedArtworkForScope(resolvedAlbum.slice.scope, id)}
              persistCachedArtwork={persistCachedArtworkForScope(resolvedAlbum.slice.scope)}
              artworkVersionById={artworkVersionById}
              coverArtCacheBump={(id) =>
                id ? artworkVersionById[artworkVersionKey(id, resolvedAlbum.slice.scope)] ?? 0 : 0
              }
              serverId={resolvedAlbum.slice.serverId}
              libraryId={resolvedAlbum.slice.libraryId}
              onPlayTrack={(t) => playTrackNow(resolvedAlbum.slice.serverId, resolvedAlbum.slice.libraryId, t)}
              onPlayNextTrack={(t) => playNextForTrack(resolvedAlbum.slice.serverId, resolvedAlbum.slice.libraryId, t)}
              onAppendTrackToQueue={(t) => appendForTrack(resolvedAlbum.slice.serverId, resolvedAlbum.slice.libraryId, t)}
              onBack={popAlbumView}
              onAppendAllToQueue={appendAllAlbumTracksToQueue}
              onShufflePlayAll={shufflePlayAllAlbumTracks}
              setTrackStarred={setTrackStarred}
            />
          ) : artistAlbumScope?.allSongs && resolvedArtist && artistDetailApi ? (
            <ArtistAllSongListView
              artistName={artistAlbumScope.name}
              scrollRestorationKey={artistAlbumScope.id}
              tracks={artistScopeTracks}
              albums={albumsFromCachedSongs(resolvedArtist.slice.songs)}
              api={artistDetailApi}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={(id) => resolveCachedArtworkForScope(resolvedArtist.slice.scope, id)}
              persistCachedArtwork={persistCachedArtworkForScope(resolvedArtist.slice.scope)}
              artworkVersionById={artworkVersionById}
              coverArtCacheBump={(id) =>
                id ? artworkVersionById[artworkVersionKey(id, resolvedArtist.slice.scope)] ?? 0 : 0
              }
              onPlayTrack={(t) => playTrackNow(resolvedArtist.slice.serverId, resolvedArtist.slice.libraryId, t)}
              onPlayNextTrack={(t) => playNextForTrack(resolvedArtist.slice.serverId, resolvedArtist.slice.libraryId, t)}
              onAppendTrackToQueue={(t) => appendForTrack(resolvedArtist.slice.serverId, resolvedArtist.slice.libraryId, t)}
              onAppendAllToQueue={appendAllArtistTracksToQueue}
              onShufflePlayAll={shufflePlayAllArtistTracks}
              onBack={popArtistView}
              serverId={resolvedArtist.slice.serverId}
              libraryId={resolvedArtist.slice.libraryId}
              setTrackStarred={setTrackStarred}
            />
          ) : artistAlbumScope?.allSongs ? (
            <Typography variant="body2" color="text.secondary">
              {t('library.linkMismatch.artist')}
            </Typography>
          ) : (
            <SongListView
              entries={songEntriesSorted}
              albums={albums}
              apiForServer={apiForServer}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={resolveCachedArtwork}
              persistCachedArtworkForScope={persistCachedArtworkForScope}
              artworkVersionKey={artworkVersionKey}
              artworkVersionById={artworkVersionById}
              onPlaySong={playSongEntryNow}
              onPlayNextSong={playNextForSongEntry}
              onAppendSongToQueue={appendForSongEntry}
              onAppendAllToQueue={appendAllSongEntriesToQueue}
              onShufflePlayAll={shufflePlayAllSongEntries}
              setTrackStarred={setTrackStarred}
            />
          ))}
      </Box>

        <LibraryBrowserPlaylistDeleteDialog {...deletePlaylistDialogProps} />
      </Box>
    </ActiveScopeGate>
  );
}
