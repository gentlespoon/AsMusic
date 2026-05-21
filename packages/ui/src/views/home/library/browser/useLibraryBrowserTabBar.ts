import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { libraryCacheScope } from '@asmusic/core';
import { useServerAndLibrary } from '../../../../contexts';
import {
  getLibraryBrowserTab,
  setLibraryBrowserTab,
} from '../../../../preferences/libraryBrowserTabPreference';
import {
  defaultLibraryBrowserView,
  hasExplicitLibraryBrowserNavigation,
  mergeLibraryBrowserSearchParams,
  parseLibraryBrowserView,
  type LibraryBrowserTab,
} from './libraryNavigationUrl';

/**
 * URL-driven library section switching, shared between {@link LibraryBrowser} and the home AppBar.
 */
export function useLibraryBrowserTabBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { servers, activeLibraryRefs } = useServerAndLibrary();

  const scopesToLoad = useMemo(() => {
    return activeLibraryRefs
      .map((ref) => {
        const s = servers.find((x) => x.id === ref.serverId);
        if (!s) return null;
        return {
          serverId: ref.serverId,
          libraryId: ref.libraryId,
          serverUrl: s.serverUrl,
          username: s.username,
          scope: libraryCacheScope(s.serverUrl, s.username, ref.libraryId),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [activeLibraryRefs, servers]);

  const searchKey = searchParams.toString();
  const view = useMemo(() => {
    const parsed = parseLibraryBrowserView(searchParams);
    if (hasExplicitLibraryBrowserNavigation(searchParams)) return parsed;
    return { ...parsed, tab: getLibraryBrowserTab() };
  }, [searchKey]);
  const { tab, album: albumSongScope, artist: artistAlbumScope, playlist: playlistScope } = view;

  useEffect(() => {
    if (hasExplicitLibraryBrowserNavigation(searchParams)) return;
    if (scopesToLoad.length === 0) return;
    const persisted = getLibraryBrowserTab();
    if (persisted === defaultLibraryBrowserView.tab) return;
    setSearchParams(
      (prev) =>
        mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
          tab: persisted,
          album: null,
          artist: null,
          playlist: null,
        }),
      { replace: true }
    );
  }, [scopesToLoad.length, searchKey, setSearchParams]);

  const selectTab = useCallback(
    (nextTab: LibraryBrowserTab) => {
      if (scopesToLoad.length === 0) return;
      setLibraryBrowserTab(nextTab);
      if (albumSongScope) {
        if (nextTab === 'albums') {
          navigate(-1);
          return;
        }
        setSearchParams(
          (prev) =>
            mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
              tab: nextTab,
              album: null,
              artist: null,
              playlist: null,
            }),
          { replace: true }
        );
        return;
      }
      if (artistAlbumScope) {
        if (artistAlbumScope.allSongs) {
          if (nextTab === 'songs') {
            navigate(-1);
            return;
          }
        } else if (nextTab === 'albums') {
          navigate(-1);
          return;
        }
        setSearchParams(
          (prev) =>
            mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
              tab: nextTab,
              album: null,
              artist: null,
              playlist: null,
            }),
          { replace: true }
        );
        return;
      }
      if (playlistScope) {
        if (nextTab === 'playlists') {
          navigate(-1);
          return;
        }
        setSearchParams(
          (prev) =>
            mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
              tab: nextTab,
              album: null,
              artist: null,
              playlist: null,
            }),
          { replace: true }
        );
        return;
      }
      setSearchParams(
        (prev) =>
          mergeLibraryBrowserSearchParams(new URLSearchParams(prev), {
            tab: nextTab,
            album: null,
            artist: null,
            playlist: null,
          }),
        { replace: true }
      );
    },
    [albumSongScope, artistAlbumScope, playlistScope, navigate, scopesToLoad.length, setSearchParams]
  );

  return {
    searchParams,
    setSearchParams,
    view,
    tab,
    selectTab,
    hasLibraries: scopesToLoad.length > 0,
  };
}
