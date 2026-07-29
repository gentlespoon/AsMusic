import { useEffect, useState } from 'react';
import { libraryCacheScope, subscribeOfflineMediaReady } from '@asmusic/core';
import { useHost } from '@ui/host/HostContext';
import {
  offlineMediaVariantForCurrentStream,
  useServerTranscodeEnabled,
} from '@ui/preferences/serverTranscodePreference';
import type { PlayerQueueItem } from './core/types';
import { trackWaveformCacheKey } from './trackWaveformCacheKey';

export function useOfflineReadyForItem(item: PlayerQueueItem | null): boolean {
  const host = useHost();
  const serverTranscodeEnabled = useServerTranscodeEnabled();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!item) {
      setReady(false);
      return;
    }

    const cacheKey = trackWaveformCacheKey(item);
    let cancelled = false;

    const check = async () => {
      const scope = libraryCacheScope(item.serverUrl, item.username, item.libraryId);
      const st = await host.offlineMedia.getStatus({
        scope,
        trackId: item.trackId,
        variant: offlineMediaVariantForCurrentStream(),
      });
      if (!cancelled) setReady(st.status === 'ready');
    };

    void check();

    return subscribeOfflineMediaReady((key) => {
      if (key === cacheKey) void check();
    });
  }, [
    item?.serverUrl,
    item?.username,
    item?.libraryId,
    item?.trackId,
    host.offlineMedia,
    serverTranscodeEnabled,
  ]);

  return ready;
}
