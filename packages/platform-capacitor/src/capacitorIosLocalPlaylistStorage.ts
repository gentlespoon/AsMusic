import {
  randomUuidV4,
  type LocalPlaylistEntry,
  type LocalPlaylistStore,
  type LocalPlaylistSummary,
} from '@asmusic/core';
import { AsmusicNative } from './asmusicNativePlugin';

function parseSummaries(json: string): LocalPlaylistSummary[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (x): x is LocalPlaylistSummary =>
      Boolean(x) &&
      typeof x === 'object' &&
      typeof (x as LocalPlaylistSummary).id === 'string' &&
      typeof (x as LocalPlaylistSummary).name === 'string' &&
      typeof (x as LocalPlaylistSummary).trackCount === 'number'
  );
}

function parseEntries(json: string): LocalPlaylistEntry[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (x): x is LocalPlaylistEntry =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as LocalPlaylistEntry).serverKey === 'string' &&
        typeof (x as LocalPlaylistEntry).libraryId === 'string' &&
        typeof (x as LocalPlaylistEntry).trackId === 'string' &&
        typeof (x as LocalPlaylistEntry).sortIndex === 'number'
    )
    .sort((a, b) => a.sortIndex - b.sortIndex);
}

export function createCapacitorIosLocalPlaylistStorage(): LocalPlaylistStore {
  return {
    backend: 'sqlite-ios-local-playlists',

    async listSummaries() {
      const { summariesJson } = await AsmusicNative.localPlaylistListSummaries();
      return parseSummaries(summariesJson);
    },

    async readEntries(playlistId) {
      const { entriesJson } = await AsmusicNative.localPlaylistReadEntries({ playlistId });
      return parseEntries(entriesJson);
    },

    async create(name) {
      const id = randomUuidV4();
      const now = Date.now();
      const { summaryJson } = await AsmusicNative.localPlaylistCreate({
        playlistId: id,
        name,
        createdAt: now,
      });
      const parsed = JSON.parse(summaryJson) as LocalPlaylistSummary;
      return parsed;
    },

    async rename(playlistId, name) {
      await AsmusicNative.localPlaylistRename({ playlistId, name, updatedAt: Date.now() });
    },

    async delete(playlistId) {
      await AsmusicNative.localPlaylistDelete({ playlistId });
    },

    async replaceEntries(playlistId, refs) {
      await AsmusicNative.localPlaylistReplaceEntries({
        playlistId,
        entriesJson: JSON.stringify(refs),
        updatedAt: Date.now(),
      });
    },

    async appendTrack(playlistId, ref) {
      await AsmusicNative.localPlaylistAppendEntry({
        playlistId,
        entryJson: JSON.stringify(ref),
        updatedAt: Date.now(),
      });
    },
  };
}
