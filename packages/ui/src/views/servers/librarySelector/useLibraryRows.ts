import { useCallback, useEffect, useState } from 'react';
import { useT } from '@asmusic/i18n';
import {
  DEFAULT_LIBRARY_ID,
  fetchMusicFolders,
  type MusicFolderSummary,
} from '@asmusic/core';
import { useServerAndLibrary } from '../../../contexts';
import type { LibraryRow } from './types';

export function useLibraryRows() {
  const t = useT();
  const { servers, getApiForServer } = useServerAndLibrary();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (servers.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const next: LibraryRow[] = [];
    try {
      for (const s of servers) {
        const api = await getApiForServer(s.id);
        if (!api) {
          next.push({
            serverId: s.id,
            serverUrl: s.serverUrl,
            username: s.username,
            libraryId: 'unreachable',
            libraryName: t('servers.libraries.unreachable'),
          });
          continue;
        }
        let folders: MusicFolderSummary[];
        try {
          folders = await fetchMusicFolders(api);
        } catch {
          folders = [];
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
      }
      setRows(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('servers.error.loadLibraries'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [servers, getApiForServer, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return { rows, loadError, loading, servers };
}
