import { useEffect, useState } from 'react';
import { libraryCacheScope } from '@asmusic/core';
import { useServerAndLibrary } from '../../../contexts';
import { useHost } from '../../../host/HostContext';
import { libraryRowKey } from './libraryRowKey';
import type { LibraryRow, LibraryRowCacheStats } from './types';

export function useLibraryRowCacheStats(
  rows: LibraryRow[],
  loading: boolean,
  refreshingKey: string | null
) {
  const host = useHost();
  const { servers } = useServerAndLibrary();
  const [cacheStatsByRowKey, setCacheStatsByRowKey] = useState<
    Record<string, LibraryRowCacheStats | null>
  >({});

  useEffect(() => {
    if (loading || servers.length === 0 || rows.length === 0) return;
    let cancelled = false;
    setCacheStatsByRowKey({});
    void (async () => {
      const entries = await Promise.all(
        rows.map(async (row): Promise<[string, LibraryRowCacheStats | null]> => {
          const rk = libraryRowKey(row);
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

  return cacheStatsByRowKey;
}
