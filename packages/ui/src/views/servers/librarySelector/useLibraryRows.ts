import { useCallback, useEffect, useState } from 'react';
import { useT } from '@asmusic/i18n';
import {
  DEFAULT_LIBRARY_ID,
  fetchMusicFolders,
  type MusicFolderSummary,
} from '@asmusic/core';
import { useServerAndLibrary } from '../../../contexts';
import {
  filterKnownRowsForServers,
  knownLibraryRowsForServer,
  persistKnownLibraryRows,
  readKnownLibraryRows,
  unreachableLibraryRow,
} from './knownLibraryRows';
import type { LibraryRow } from './types';

export function useLibraryRows() {
  const t = useT();
  const { servers, activeLibraryRefs, getApiForServer } = useServerAndLibrary();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (servers.length === 0) {
      setRows([]);
      return;
    }
    setRows((prev) => {
      if (prev.length > 0) return prev;
      return filterKnownRowsForServers(readKnownLibraryRows(), servers);
    });
  }, [servers]);

  const loadAll = useCallback(async () => {
    if (servers.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const knownRows = filterKnownRowsForServers(readKnownLibraryRows(), servers);
    const next: LibraryRow[] = [];
    let hadError = false;
    try {
      for (const s of servers) {
        const fallbackRows = () =>
          knownLibraryRowsForServer(s, knownRows, activeLibraryRefs, t('servers.defaultLibraryName'));

        try {
          const api = await getApiForServer(s.id);
          if (!api) {
            const fallback = fallbackRows();
            if (fallback.length === 1 && fallback[0].libraryId === DEFAULT_LIBRARY_ID) {
              next.push(unreachableLibraryRow(s, t('servers.libraries.unreachable')));
            } else {
              next.push(...fallback);
            }
            continue;
          }
          let folders: MusicFolderSummary[];
          try {
            folders = await fetchMusicFolders(api);
          } catch {
            next.push(...fallbackRows());
            continue;
          }
          if (folders.length === 0) {
            next.push({
              serverId: s.id,
              serverUrl: s.serverUrl,
              username: s.username,
              libraryId: DEFAULT_LIBRARY_ID,
              libraryName: t('servers.defaultLibraryName'),
            });
            continue;
          }
          for (const f of folders) {
            next.push({
              serverId: s.id,
              serverUrl: s.serverUrl,
              username: s.username,
              libraryId: f.id,
              libraryName: f.name,
            });
          }
        } catch {
          hadError = true;
          next.push(...fallbackRows());
        }
      }
      setRows(next);
      persistKnownLibraryRows(next);
      if (hadError) {
        setLoadError(t('servers.error.loadLibraries'));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('servers.error.loadLibraries'));
      setRows((prev) => {
        if (next.length > 0) return next;
        if (prev.length > 0) return prev;
        return knownRows;
      });
    } finally {
      setLoading(false);
    }
  }, [servers, activeLibraryRefs, getApiForServer, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return { rows, loadError, loading, servers };
}
