export type LibrarySelectorViewProps = {
  embedded?: boolean;
};

export type LibraryRow = {
  serverId: string;
  serverUrl: string;
  username: string;
  libraryId: string;
  libraryName: string;
};

export type LibraryRowCacheStats = {
  albumCount: number;
  songCount: number;
  lastSyncAt: number | null;
};
