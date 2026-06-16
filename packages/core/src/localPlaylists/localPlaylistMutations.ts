import type { Child } from 'subsonic-api';
import { randomUuidV4 } from '../lib/randomUuid';
import { playlistEditDiff } from '../library/playlistMutations';
import type {
  LocalPlaylistEntry,
  LocalPlaylistStore,
  LocalPlaylistSummary,
  LocalPlaylistTrackRef,
} from './LocalPlaylistStore';

/** Stable composite key for editor membership (track ids may repeat across scopes). */
export function localPlaylistEntryKey(ref: Pick<LocalPlaylistTrackRef, 'serverKey' | 'libraryId' | 'trackId'>): string {
  return `${ref.serverKey}|${ref.libraryId}|${ref.trackId}`;
}

export function localPlaylistRefFromKey(key: string): LocalPlaylistTrackRef | null {
  const parts = key.split('|');
  if (parts.length !== 3) return null;
  const [serverKey, libraryId, trackId] = parts;
  if (!serverKey || !libraryId || !trackId) return null;
  return { serverKey, libraryId, trackId };
}

export function localPlaylistTrackRefFromChild(
  scope: { serverKey: string; libraryId: string },
  song: Child
): LocalPlaylistTrackRef {
  return {
    serverKey: scope.serverKey,
    libraryId: scope.libraryId,
    trackId: String(song.id),
    title: song.title ?? undefined,
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    coverArtId: song.coverArt?.trim() || undefined,
  };
}

export async function createLocalPlaylist(
  store: LocalPlaylistStore,
  name: string
): Promise<LocalPlaylistSummary> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Playlist name cannot be empty');
  return store.create(trimmed);
}

export async function deleteLocalPlaylist(store: LocalPlaylistStore, playlistId: string): Promise<void> {
  await store.delete(playlistId);
}

export async function addTrackToLocalPlaylist(
  store: LocalPlaylistStore,
  args: { playlistId: string; ref: LocalPlaylistTrackRef }
): Promise<void> {
  await store.appendTrack(args.playlistId, args.ref);
}

/** Apply checkbox editor diff to local playlist entries. */
export async function updateLocalPlaylistMembership(
  store: LocalPlaylistStore,
  args: {
    playlistId: string;
    entries: readonly LocalPlaylistEntry[];
    songIdsToAdd: string[];
    songIndexesToRemove: number[];
    resolveRefForNewId: (compositeKey: string) => LocalPlaylistTrackRef | null;
  }
): Promise<void> {
  const { playlistId, entries, songIdsToAdd, songIndexesToRemove, resolveRefForNewId } = args;
  let next = entries.slice();
  for (const idx of [...songIndexesToRemove].sort((a, b) => b - a)) {
    if (idx >= 0 && idx < next.length) next.splice(idx, 1);
  }
  for (const compositeKey of songIdsToAdd) {
    const ref = resolveRefForNewId(compositeKey);
    if (ref) next.push({ ...ref, sortIndex: next.length });
  }
  const refs: LocalPlaylistTrackRef[] = next.map(({ sortIndex: _i, ...ref }) => ref);
  await store.replaceEntries(playlistId, refs);
}

export function localPlaylistEditDiff(args: {
  originalEntryKeys: string[];
  selectedEntryKeys: Set<string>;
}): { songIdsToAdd: string[]; songIndexesToRemove: number[] } {
  return playlistEditDiff({
    originalEntryIds: args.originalEntryKeys,
    selectedSongIds: args.selectedEntryKeys,
  });
}

export function newLocalPlaylistId(): string {
  return randomUuidV4();
}
