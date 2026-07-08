import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type LocalPlaylistEntry,
} from '@asmusic/core';
import { AlbumListView } from './catalog/AlbumListView';
import { ArtistListView } from './catalog/ArtistListView';
import { SongListView } from './catalog/SongListView';
import { AlbumSongListView } from './detail/AlbumSongListView';
import { ArtistAlbumListView } from './detail/ArtistAlbumListView';
import { ArtistAllSongListView } from './detail/ArtistAllSongListView';
import { LocalPlaylistEditorView } from './detail/LocalPlaylistEditorView';
import { LocalPlaylistSongListView } from './detail/LocalPlaylistSongListView';
import { PlaylistEditorView } from './detail/PlaylistEditorView';
import { PlaylistSongListView } from './detail/PlaylistSongListView';
import { PlaylistListView } from './playlists/PlaylistListView';
import { useHost } from '@ui/host/HostContext';
import { useLibraryBrowseCache } from '@ui/contexts';
import { createPersistCachedArtworkForScope } from '@ui/shared/libraryArtworkCacheAccess';
import { createResolveCachedArtwork } from '@ui/shared/createResolveCachedArtwork';
import { ActiveScopeGate } from './browser/ActiveScopeGate';
import {
  defaultLibraryBrowserView,
  mergeLibraryBrowserSearchParams,
  parseLibraryBrowserView,
  encodeLibraryBrowserRef,
  encodeLocalPlaylistRef,
  encodeServerPlaylistRef,
  decodeLocalPlaylistRef,
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
import type { PlaylistCatalogRow } from '@ui/contexts/LibraryBrowseCacheContext';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';

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
    albumCatalogRows,
    artistCatalogRows,
    songEntriesSorted,
    favoriteSongEntriesSorted,
    playlistCatalogRows,
    serverPlaylistsByServerKey,
    multiServer,
    localPlaylistSummaries,
    readLocalPlaylistEntries,
    initialReady,
    cacheReadError,
    syncing,
    syncError,
    syncProgress,
    apiForServer,
    artworkVersionKey,
    getArtworkCacheBump,
    notifyArtworkCached,
    setTrackStarred,
  } = useLibraryBrowseCache();

  const [localPlaylistEntriesById, setLocalPlaylistEntriesById] = useState<
    Record<string, LocalPlaylistEntry[]>
  >({});

  const songsByScope = useMemo(() => {
    const map = new Map<string, import('subsonic-api').Child[]>();
    for (const sl of slices) {
      map.set(`${sl.scope.serverKey}|${sl.scope.libraryId}`, sl.songs);
    }
    return map;
  }, [slices]);

  const albumsByScope = useMemo(() => {
    const map = new Map<string, ReturnType<typeof albumsFromCachedSongs>>();
    for (const sl of slices) {
      map.set(`${sl.scope.serverKey}|${sl.scope.libraryId}`, albumsFromCachedSongs(sl.songs));
    }
    return map;
  }, [slices]);

  const searchKey = searchParams.toString();
  const { tab, album: albumSongScope, artist: artistAlbumScope, playlist: playlistScope } = view;

  const resolveCachedArtworkForScope = useCallback(
    (sc: LibraryCacheScope, coverArtId: string) => {
      const sl = slices.find(
        (s) => s.scope.serverKey === sc.serverKey && s.scope.libraryId === sc.libraryId,
      );
      if (!sl) {
        return host.libraryCache.readArtworkBlob(sc, coverArtId);
      }
      return createResolveCachedArtwork(
        host.libraryCache,
        sl.serverUrl,
        sl.username,
        sc.libraryId,
      )(coverArtId);
    },
    [host.libraryCache, slices],
  );

  const resolveCachedArtwork = useCallback(
    (coverArtId: string, sc: LibraryCacheScope) => resolveCachedArtworkForScope(sc, coverArtId),
    [resolveCachedArtworkForScope],
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
    serverPlaylistsByServerKey,
    localPlaylistSummaries,
    localPlaylistEntriesById,
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
    playLocalResolvedRow,
    playNextLocalResolvedRow,
    appendLocalResolvedRowToQueue,
    replaceQueueAndPlayAllLocalPlaylist,
    appendAllLocalPlaylistToQueue,
    shufflePlayAllLocalPlaylist,
  } = useLibraryBrowserPlayback({
    resolvedAlbum,
    resolvedArtist,
    resolvedPlaylist,
    songsByScope,
    albumsByScope,
  });

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
      const playlistUrlId =
        row.kind === 'local'
          ? encodeLocalPlaylistRef(row.playlist.id)
          : multiServer
            ? encodeServerPlaylistRef({
                serverKey: row.serverKey,
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
    [multiServer, setSearchParams]
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
  const playlistDetailApi =
    resolvedPlaylist?.kind === 'server' ? apiForServer(resolvedPlaylist.serverId) : null;

  const playlistHeaderTitle = useMemo(() => {
    if (!playlistScope) return '';
    if (resolvedPlaylist?.summary?.name) return resolvedPlaylist.summary.name;
    return playlistScope.name;
  }, [playlistScope, resolvedPlaylist]);

  const {
    playlistEditorTarget,
    playlistDetailReloadToken,
    canCreateServerPlaylist,
    canCreateLocalPlaylist,
    handleCreatePlaylist,
    handleDeletePlaylistRow,
    closePlaylistEditor,
    openPlaylistEditor,
    savePlaylistEditor,
    requestDeletePlaylist,
    deletePlaylistDialogProps,
  } = useLibraryBrowserPlaylists({
    scopesToLoad,
    singleSlice,
    songEntries: songEntriesSorted,
    resolvedPlaylist,
    playlistHeaderTitle,
    playlistDetailApi,
    onAfterPlaylistDeleted: popPlaylistView,
  });

  useEffect(() => {
    if (!playlistScope) return;
    const local = decodeLocalPlaylistRef(playlistScope.id);
    if (!local) return;
    let cancelled = false;
    void readLocalPlaylistEntries(local.id).then((entries) => {
      if (!cancelled) {
        setLocalPlaylistEntriesById((prev) => ({ ...prev, [local.id]: entries }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [playlistScope, readLocalPlaylistEntries, playlistDetailReloadToken]);

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
              coverArtCacheBump={(id) =>
                id ? getArtworkCacheBump(id, resolvedArtist.slice.scope) : 0
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
              getArtworkCacheBump={getArtworkCacheBump}
              artworkVersionKey={artworkVersionKey}
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
            playlistEditorTarget.kind === 'local' ? (
              <LocalPlaylistEditorView
                playlistId={playlistEditorTarget.playlistId}
                playlistName={playlistEditorTarget.playlistName}
                songEntries={playlistEditorTarget.songEntries}
                entries={
                  resolvedPlaylist?.kind === 'local' ? resolvedPlaylist.entries : []
                }
                onBack={closePlaylistEditor}
                onSave={savePlaylistEditor}
              />
            ) : (
              <PlaylistEditorView
                playlistId={playlistEditorTarget.playlistId}
                playlistName={playlistEditorTarget.playlistName}
                cachedSongs={playlistEditorTarget.cachedSongs}
                serverKey={playlistEditorTarget.serverKey}
                storage={host.libraryCache}
                api={playlistEditorTarget.api}
                onBack={closePlaylistEditor}
                onSave={savePlaylistEditor}
              />
            )
          ) : playlistScope && resolvedPlaylist?.kind === 'local' ? (
            <LocalPlaylistSongListView
              playlistId={resolvedPlaylist.localId}
              scrollRestorationKey={playlistScope.id}
              playlistTitle={playlistHeaderTitle}
              entries={resolvedPlaylist.entries}
              songsByScope={songsByScope}
              albumsByScope={albumsByScope}
              apiForServer={apiForServer}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtworkForScope={resolveCachedArtworkForScope}
              persistCachedArtworkForScope={persistCachedArtworkForScope}
              getArtworkCacheBump={getArtworkCacheBump}
              onBack={popPlaylistView}
              onPlayResolvedRow={playLocalResolvedRow}
              onPlayNextResolvedRow={playNextLocalResolvedRow}
              onAppendResolvedRowToQueue={appendLocalResolvedRowToQueue}
              onAppendAllToQueue={appendAllLocalPlaylistToQueue}
              onShufflePlayAll={shufflePlayAllLocalPlaylist}
              onReplaceQueueAndPlayAll={replaceQueueAndPlayAllLocalPlaylist}
              reloadToken={playlistDetailReloadToken}
              onEditPlaylist={openPlaylistEditor}
              onDeletePlaylist={requestDeletePlaylist}
              setTrackStarred={setTrackStarred}
            />
          ) : playlistScope && resolvedPlaylist?.kind === 'server' && playlistDetailApi ? (
            <PlaylistSongListView
              playlistId={resolvedPlaylist.subsonicPlaylistId}
              scrollRestorationKey={playlistScope.id}
              playlistTitle={playlistHeaderTitle}
              cachedSongs={resolvedPlaylist.cachedSongs}
              albums={albumsFromCachedSongs(resolvedPlaylist.cachedSongs)}
              api={playlistDetailApi}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={(id, trackId) => {
                const scope = resolvedPlaylist.findTrackScope(trackId) ?? slices[0]?.scope;
                return scope ? resolveCachedArtworkForScope(scope, id) : Promise.resolve(null);
              }}
              persistCachedArtworkForTrack={(trackId) => {
                const scope = resolvedPlaylist.findTrackScope(trackId) ?? slices[0]?.scope;
                return scope ? persistCachedArtworkForScope(scope) : async () => {};
              }}
              coverArtCacheBump={(id, trackId) => {
                const scope = resolvedPlaylist.findTrackScope(trackId) ?? slices[0]?.scope;
                return id && scope ? getArtworkCacheBump(id, scope) : 0;
              }}
              artworkCacheKeyFor={(id, trackId) => {
                const scope = resolvedPlaylist.findTrackScope(trackId) ?? slices[0]?.scope;
                return scope ? artworkVersionKey(id, scope) : id;
              }}
              serverId={resolvedPlaylist.serverId}
              resolveTrackLibraryId={(trackId) =>
                resolvedPlaylist.findTrackScope(trackId)?.libraryId ?? null
              }
              serverKey={resolvedPlaylist.serverKey}
              onBack={popPlaylistView}
              onPlayTrack={(track) => {
                const libraryId = resolvedPlaylist.findTrackScope(String(track.id))?.libraryId;
                if (!libraryId) return;
                playTrackNow(resolvedPlaylist.serverId, libraryId, track);
              }}
              onPlayNextTrack={(track) => {
                const libraryId = resolvedPlaylist.findTrackScope(String(track.id))?.libraryId;
                if (!libraryId) return;
                playNextForTrack(resolvedPlaylist.serverId, libraryId, track);
              }}
              onAppendTrackToQueue={(track) => {
                const libraryId = resolvedPlaylist.findTrackScope(String(track.id))?.libraryId;
                if (!libraryId) return;
                appendForTrack(resolvedPlaylist.serverId, libraryId, track);
              }}
              onAppendAllToQueue={appendAllPlaylistTracksToQueue}
              onShufflePlayAll={shufflePlayAllPlaylistTracks}
              onReplaceQueueAndPlayAll={replaceQueueAndPlayAllPlaylistTracks}
              reloadToken={playlistDetailReloadToken}
              onEditPlaylist={openPlaylistEditor}
              canEditPlaylist={Boolean(playlistDetailApi)}
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
              canCreateServerPlaylist={canCreateServerPlaylist}
              canCreateLocalPlaylist={canCreateLocalPlaylist}
              multiServer={multiServer}
              serversToCreateOn={scopesToLoad.reduce(
                (acc, sl) => {
                  if (!acc.some((s) => s.serverId === sl.serverId)) {
                    acc.push({ serverId: sl.serverId, serverUrl: sl.serverUrl, username: sl.username });
                  }
                  return acc;
                },
                [] as { serverId: string; serverUrl: string; username: string }[]
              )}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylistRow}
              onPlaylistOpen={openPlaylist}
            />
          ))}

        {tab === 'favorites' && (
            <SongListView
              entries={favoriteSongEntriesSorted}
              albumsByScope={albumsByScope}
            apiForServer={apiForServer}
            initialReady={initialReady}
            syncing={syncing}
            resolveCachedArtwork={resolveCachedArtwork}
            persistCachedArtworkForScope={persistCachedArtworkForScope}
            artworkVersionKey={artworkVersionKey}
            getArtworkCacheBump={getArtworkCacheBump}
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
              coverArtCacheBump={(id) =>
                id ? getArtworkCacheBump(id, resolvedAlbum.slice.scope) : 0
              }
              artworkCacheKeyFor={(id) => artworkVersionKey(id, resolvedAlbum.slice.scope)}
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
              coverArtCacheBump={(id) =>
                id ? getArtworkCacheBump(id, resolvedArtist.slice.scope) : 0
              }
              artworkCacheKeyFor={(id) => artworkVersionKey(id, resolvedArtist.slice.scope)}
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
              albumsByScope={albumsByScope}
              apiForServer={apiForServer}
              initialReady={initialReady}
              syncing={syncing}
              resolveCachedArtwork={resolveCachedArtwork}
              persistCachedArtworkForScope={persistCachedArtworkForScope}
              artworkVersionKey={artworkVersionKey}
              getArtworkCacheBump={getArtworkCacheBump}
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
