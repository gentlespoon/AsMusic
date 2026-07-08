import type { PlayerQueueItem } from './types';

export const PLAYBACK_QUEUE_STATE_KEY = 'asmusic-playback-queue-v1';

export type PersistedPlaybackQueueV1 = {
  v: 1;
  queue: PlayerQueueItem[];
  currentIndex: number | null;
  loopQueue: boolean;
  loopOne: boolean;
  positionSeconds: number;
};

export function parsePersistedQueue(raw: string | null): PersistedPlaybackQueueV1 | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return null;
    const v = (o as { v?: unknown }).v;
    if (v !== 1) return null;
    const queue = (o as { queue?: unknown }).queue;
    if (!Array.isArray(queue)) return null;
    const cleaned: PlayerQueueItem[] = [];
    for (const row of queue) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (
        typeof r.rowId === 'string' &&
        typeof r.serverId === 'string' &&
        typeof r.libraryId === 'string' &&
        typeof r.trackId === 'string' &&
        typeof r.serverUrl === 'string' &&
        typeof r.username === 'string' &&
        typeof r.title === 'string'
      ) {
        cleaned.push({
          rowId: r.rowId,
          serverId: r.serverId,
          libraryId: r.libraryId,
          trackId: r.trackId,
          serverUrl: r.serverUrl,
          username: r.username,
          title: r.title,
          artist: typeof r.artist === 'string' ? r.artist : undefined,
          album: typeof r.album === 'string' ? r.album : undefined,
          durationSeconds: typeof r.durationSeconds === 'number' ? r.durationSeconds : undefined,
          suffix: typeof r.suffix === 'string' ? r.suffix : undefined,
          bitRate: typeof r.bitRate === 'number' ? r.bitRate : undefined,
          coverArtId: typeof r.coverArtId === 'string' ? r.coverArtId : undefined,
          coverArtFallbackId:
            typeof r.coverArtFallbackId === 'string' ? r.coverArtFallbackId : undefined,
          starred: typeof r.starred === 'boolean' ? r.starred : undefined,
        });
      }
    }
    const currentIndex = (o as { currentIndex?: unknown }).currentIndex;
    const idx =
      currentIndex === null
        ? null
        : typeof currentIndex === 'number' && Number.isFinite(currentIndex)
          ? Math.floor(currentIndex)
          : null;
    const rawPosition = (o as { positionSeconds?: unknown }).positionSeconds;
    const positionSeconds =
      typeof rawPosition === 'number' && Number.isFinite(rawPosition) && rawPosition >= 0
        ? rawPosition
        : 0;
    return {
      v: 1,
      queue: cleaned,
      currentIndex: idx,
      loopQueue: Boolean((o as { loopQueue?: unknown }).loopQueue),
      loopOne: Boolean((o as { loopOne?: unknown }).loopOne),
      positionSeconds,
    };
  } catch {
    return null;
  }
}
