import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@asmusic/i18n';
import {
  albumsFromCachedSongs,
  collectCoverArtIdsFromAlbums,
  libraryCacheScope,
  refreshLibraryCache,
  runLibraryArtworkBackgroundCache,
} from '@asmusic/core';
import { useServerAndLibrary, useLibraryBrowseCache } from '../../../contexts';
import { useHost } from '../../../host/HostContext';
import { libraryRowKey } from './libraryRowKey';
import type { LibraryRow } from './types';

export function useRefreshLibraryRow() {
  const t = useT();
  const host = useHost();
  const { servers, getApiForServer, isLibraryActive } = useServerAndLibrary();
  const { reloadCachedSongsFromDisk } = useLibraryBrowseCache();
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const artworkAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      artworkAbortRef.current?.abort();
    };
  }, []);

  const refreshLibraryRow = useCallback(
    async (row: LibraryRow) => {
      if (row.libraryId === 'unreachable') return;
      const ref = { serverId: row.serverId, libraryId: row.libraryId };
      if (!isLibraryActive(ref)) return;
      const server = servers.find((s) => s.id === row.serverId);
      if (!server) return;

      const key = libraryRowKey(row);
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
        const { songs } = await refreshLibraryCache(api, host.libraryCache, scope, undefined, {
          offlineMedia: host.offlineMedia,
        });
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
    [getApiForServer, host.libraryCache, host.offlineMedia, isLibraryActive, reloadCachedSongsFromDisk, servers, t]
  );

  return {
    refreshingKey,
    refreshError,
    setRefreshError,
    refreshLibraryRow,
  };
}
