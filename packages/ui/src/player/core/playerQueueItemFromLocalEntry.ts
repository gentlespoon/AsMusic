import type { Child } from 'subsonic-api';
import {
  playerQueueItemFromLocalEntry,
  resolveLocalPlaylistEntrySync,
  type LocalPlaylistEntry,
  type LocalPlaylistResolvedEntry,
  type LocalPlaylistTrackRef,
  type ServerConfigForLocalPlaylist,
} from '@asmusic/core';
import { playerQueueItemFromChild } from './playerQueueItemFromChild';
import type { PlayerQueueItem } from './types';

export function playerQueueItemFromLocalPlaylistEntry(args: {
  ref: LocalPlaylistTrackRef;
  song?: Child;
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): PlayerQueueItem {
  const item = playerQueueItemFromLocalEntry(args);
  return (item ?? {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    serverId: '',
    libraryId: args.ref.libraryId,
    trackId: args.ref.trackId,
    serverUrl: '',
    username: '',
    title: args.unavailableLabel,
  }) as PlayerQueueItem;
}

export function playerQueueItemsFromLocalResolvedEntries(args: {
  resolved: readonly LocalPlaylistResolvedEntry[];
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): PlayerQueueItem[] {
  return args.resolved.map((row) => {
    if (row.status === 'available') {
      const server = args.servers.find((s) => s.id === row.serverId);
      if (server) {
        return playerQueueItemFromChild({
          song: row.song,
          serverId: row.serverId,
          libraryId: row.libraryId,
          serverUrl: server.serverUrl,
          username: server.username,
        });
      }
    }
    return playerQueueItemFromLocalPlaylistEntry({
      ref: row.ref,
      song: row.status === 'available' ? row.song : undefined,
      servers: args.servers,
      unavailableLabel: args.unavailableLabel,
    });
  });
}

export function localPlaylistEntriesToResolvedSync(args: {
  entries: readonly LocalPlaylistEntry[];
  songsByScope: ReadonlyMap<string, Child[]>;
  servers: readonly ServerConfigForLocalPlaylist[];
  unavailableLabel: string;
}): LocalPlaylistResolvedEntry[] {
  return args.entries.map((entry) =>
    resolveLocalPlaylistEntrySync({
      entry,
      songsByScope: args.songsByScope,
      servers: args.servers,
      unavailableLabel: args.unavailableLabel,
    })
  );
}
