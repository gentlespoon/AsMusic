import { isChildStarred } from '@asmusic/core';
import type { Child } from 'subsonic-api';
import type { PlayerQueueItem } from './types';

export function newQueueRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Ensures each item has a `rowId` (fills missing for defensive callers). */
export function ensureQueueRowIds(items: readonly PlayerQueueItem[]): PlayerQueueItem[] {
  return items.map((it) => (it.rowId ? it : { ...it, rowId: newQueueRowId() }));
}

export function playerQueueItemFromChild(args: {
  song: Child;
  serverId: string;
  libraryId: string;
  serverUrl: string;
  username: string;
}): PlayerQueueItem {
  const { song, serverId, libraryId, serverUrl, username } = args;
  return {
    rowId: newQueueRowId(),
    serverId,
    libraryId,
    trackId: String(song.id),
    serverUrl,
    username,
    title: song.title ?? '—',
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    durationSeconds: song.duration ?? undefined,
    suffix: song.suffix ?? undefined,
    bitRate: song.bitRate ?? undefined,
    coverArtId: song.coverArt?.trim() || undefined,
    starred: isChildStarred(song),
  };
}
