/**
 * Device-local cross-library playlists. Entries reference cached tracks by scope + id;
 * not synced to Subsonic and not tied to {@link LibraryCacheStorage} playlist summaries.
 */

export type LocalPlaylistSummary = {
  id: string;
  name: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalPlaylistTrackRef = {
  serverKey: string;
  libraryId: string;
  trackId: string;
  title?: string;
  artist?: string;
  album?: string;
  coverArtId?: string;
};

export type LocalPlaylistEntry = LocalPlaylistTrackRef & {
  sortIndex: number;
};

export interface LocalPlaylistStore {
  readonly backend: string;
  listSummaries(): Promise<LocalPlaylistSummary[]>;
  readEntries(playlistId: string): Promise<LocalPlaylistEntry[]>;
  create(name: string): Promise<LocalPlaylistSummary>;
  rename(playlistId: string, name: string): Promise<void>;
  delete(playlistId: string): Promise<void>;
  replaceEntries(playlistId: string, refs: readonly LocalPlaylistTrackRef[]): Promise<void>;
  appendTrack(playlistId: string, ref: LocalPlaylistTrackRef): Promise<void>;
}

export function createNoopLocalPlaylistStore(): LocalPlaylistStore {
  return {
    backend: 'noop',
    async listSummaries() {
      return [];
    },
    async readEntries() {
      return [];
    },
    async create(name) {
      const now = Date.now();
      return { id: 'noop', name, trackCount: 0, createdAt: now, updatedAt: now };
    },
    async rename() {},
    async delete() {},
    async replaceEntries() {},
    async appendTrack() {
      throw new Error('LocalPlaylistStore is not available on this host');
    },
  };
}
