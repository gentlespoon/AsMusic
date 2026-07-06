export const PENDING_STAR_MUTATIONS_STORAGE_KEY = 'asmusic-pending-star-mutations-v1';

export type PendingStarMutation = {
  serverId: string;
  libraryId: string;
  trackId: string;
  starred: boolean;
  queuedAt: number;
};

export function pendingStarMutationKey(
  m: Pick<PendingStarMutation, 'serverId' | 'libraryId' | 'trackId'>,
): string {
  return `${m.serverId}|${m.libraryId}|${m.trackId}`;
}

function isPendingStarMutation(v: unknown): v is PendingStarMutation {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.serverId === 'string' &&
    typeof o.libraryId === 'string' &&
    typeof o.trackId === 'string' &&
    typeof o.starred === 'boolean' &&
    typeof o.queuedAt === 'number'
  );
}

/** Latest intent per track wins (same-device coalescing before flush). */
export function coalescePendingStarMutations(
  queue: readonly PendingStarMutation[],
): PendingStarMutation[] {
  const byKey = new Map<string, PendingStarMutation>();
  for (const m of queue) {
    const key = pendingStarMutationKey(m);
    const existing = byKey.get(key);
    if (!existing || m.queuedAt >= existing.queuedAt) {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()].sort((a, b) => a.queuedAt - b.queuedAt);
}

export function parsePendingStarMutationsJson(json: string | null | undefined): PendingStarMutation[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingStarMutation);
  } catch {
    return [];
  }
}

export function serializePendingStarMutations(queue: readonly PendingStarMutation[]): string {
  return JSON.stringify(queue);
}

export function upsertPendingStarMutation(
  queue: readonly PendingStarMutation[],
  mutation: Omit<PendingStarMutation, 'queuedAt'> & { queuedAt?: number },
): PendingStarMutation[] {
  const entry: PendingStarMutation = {
    ...mutation,
    queuedAt: mutation.queuedAt ?? Date.now(),
  };
  return coalescePendingStarMutations([...queue, entry]);
}

export function removePendingStarMutations(
  queue: readonly PendingStarMutation[],
  toRemove: readonly PendingStarMutation[],
): PendingStarMutation[] {
  const removeKeys = new Set(toRemove.map(pendingStarMutationKey));
  return queue.filter((m) => !removeKeys.has(pendingStarMutationKey(m)));
}
