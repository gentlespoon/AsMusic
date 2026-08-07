import { useCallback, useState } from 'react';
import { useT } from '@asmusic/i18n';
import {
  libraryCacheScope,
  refreshLibraryCache,
  refreshPlaylistCacheForServer,
  waitForServerLibraryScan,
} from '@asmusic/core';
import { useServerAndLibrary, useLibraryBrowseCache } from '@ui/contexts';
import { useHost } from '@ui/host/HostContext';
import {
  getServerLibraryRescanBeforeSyncEnabled,
} from '@ui/preferences/serverLibraryRescanBeforeSyncPreference';
import { libraryRowKey } from './libraryRowKey';
import type { LibraryRow } from './types';

export function useRefreshLibraryRow() {
  const t = useT();
  const host = useHost();
  const { servers, getApiForServer, isLibraryActive } = useServerAndLibrary();
  const { reloadCachedSongsFromDisk, flushPendingLibraryMutations } = useLibraryBrowseCache();
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

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

      try {
        // Push offline stars / play scrobbles before replace so server truth includes them when possible.
        await flushPendingLibraryMutations();
        const api = await getApiForServer(row.serverId);
        if (!api) {
          throw new Error(t('servers.error.noSession', { url: row.serverUrl }));
        }
        if (getServerLibraryRescanBeforeSyncEnabled()) {
          try {
            await waitForServerLibraryScan(api, { libraryId: row.libraryId });
          } catch (e) {
            if (e instanceof Error && e.message.includes('timed out')) {
              throw new Error(t('servers.error.scanTimeout'));
            }
            throw new Error(t('servers.error.scanFailed'));
          }
        }
        const scope = libraryCacheScope(server.serverUrl, server.username, row.libraryId);
        await refreshLibraryCache(api, host.libraryCache, scope, undefined, {
          offlineMedia: host.offlineMedia,
        });
        await refreshPlaylistCacheForServer(api, host.libraryCache, { serverKey: scope.serverKey });
        await reloadCachedSongsFromDisk();
      } catch (e) {
        setRefreshError(e instanceof Error ? e.message : t('servers.error.syncFailed'));
      } finally {
        setRefreshingKey(null);
      }
    },
    [
      flushPendingLibraryMutations,
      getApiForServer,
      host.libraryCache,
      host.offlineMedia,
      isLibraryActive,
      reloadCachedSongsFromDisk,
      servers,
      t,
    ]
  );

  return {
    refreshingKey,
    refreshError,
    setRefreshError,
    refreshLibraryRow,
  };
}
