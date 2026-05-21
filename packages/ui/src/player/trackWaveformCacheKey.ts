import { libraryCacheScope, offlineMediaKeyId } from '@asmusic/core';
import type { PlayerQueueItem } from './core/types';

export function trackWaveformCacheKey(item: PlayerQueueItem): string {
  const scope = libraryCacheScope(item.serverUrl, item.username, item.libraryId);
  return offlineMediaKeyId({ scope, trackId: item.trackId });
}
