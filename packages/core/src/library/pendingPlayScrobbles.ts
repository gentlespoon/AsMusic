import { randomUuidV4 } from '../lib/randomUuid';

export const PENDING_PLAY_SCROBBLES_STORAGE_KEY = 'asmusic-pending-play-scrobbles-v1';

/** How often to retry flushing pending play scrobbles to the server. */
export const PENDING_PLAY_SCROBBLES_RETRY_INTERVAL_MS = 5 * 60 * 1000;

/** Soft cap: drop oldest events when the queue exceeds this length. */
export const PENDING_PLAY_SCROBBLES_MAX_QUEUE = 2000;

export type PendingPlayScrobble = {
  /** Stable event id for remove-after-flush (one entry per listen). */
  id: string;
  serverId: string;
  libraryId: string;
  trackId: string;
  /** Epoch ms when the listen completed (Subsonic `scrobble` `time`). */
  playedAt: number;
  queuedAt: number;
};

export function pendingPlayTrackKey(
  m: Pick<PendingPlayScrobble, 'serverId' | 'libraryId' | 'trackId'>,
): string {
  return `${m.serverId}|${m.libraryId}|${m.trackId}`;
}

function isPendingPlayScrobble(v: unknown): v is PendingPlayScrobble {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.serverId === 'string' &&
    typeof o.libraryId === 'string' &&
    typeof o.trackId === 'string' &&
    typeof o.playedAt === 'number' &&
    typeof o.queuedAt === 'number'
  );
}

export function parsePendingPlayScrobblesJson(json: string | null | undefined): PendingPlayScrobble[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingPlayScrobble);
  } catch {
    return [];
  }
}

export function serializePendingPlayScrobbles(queue: readonly PendingPlayScrobble[]): string {
  return JSON.stringify(queue);
}

/** Drop oldest events when over the soft cap (keeps newest). */
export function capPendingPlayScrobbles(
  queue: readonly PendingPlayScrobble[],
  max = PENDING_PLAY_SCROBBLES_MAX_QUEUE,
): PendingPlayScrobble[] {
  if (queue.length <= max) return [...queue];
  const sorted = [...queue].sort((a, b) => a.queuedAt - b.queuedAt);
  return sorted.slice(sorted.length - max);
}

export function appendPendingPlayScrobble(
  queue: readonly PendingPlayScrobble[],
  event: Omit<PendingPlayScrobble, 'id' | 'queuedAt'> & {
    id?: string;
    queuedAt?: number;
  },
): PendingPlayScrobble[] {
  const entry: PendingPlayScrobble = {
    id: event.id ?? randomUuidV4(),
    serverId: event.serverId,
    libraryId: event.libraryId,
    trackId: event.trackId,
    playedAt: event.playedAt,
    queuedAt: event.queuedAt ?? Date.now(),
  };
  return capPendingPlayScrobbles([...queue, entry]);
}

export function removePendingPlayScrobblesById(
  queue: readonly PendingPlayScrobble[],
  ids: readonly string[],
): PendingPlayScrobble[] {
  const remove = new Set(ids);
  return queue.filter((m) => !remove.has(m.id));
}

export function pendingCountForTrack(
  queue: readonly PendingPlayScrobble[],
  track: Pick<PendingPlayScrobble, 'serverId' | 'libraryId' | 'trackId'>,
): number {
  const key = pendingPlayTrackKey(track);
  let n = 0;
  for (const m of queue) {
    if (pendingPlayTrackKey(m) === key) n += 1;
  }
  return n;
}

/** Aggregate pending delta per track for reapply after a library sync. */
export function pendingPlayDeltasByTrack(queue: readonly PendingPlayScrobble[]): Map<
  string,
  { serverId: string; libraryId: string; trackId: string; count: number; latestPlayedAt: number }
> {
  const byKey = new Map<
    string,
    { serverId: string; libraryId: string; trackId: string; count: number; latestPlayedAt: number }
  >();
  for (const m of queue) {
    const key = pendingPlayTrackKey(m);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        serverId: m.serverId,
        libraryId: m.libraryId,
        trackId: m.trackId,
        count: 1,
        latestPlayedAt: m.playedAt,
      });
    } else {
      existing.count += 1;
      if (m.playedAt > existing.latestPlayedAt) {
        existing.latestPlayedAt = m.playedAt;
      }
    }
  }
  return byKey;
}
