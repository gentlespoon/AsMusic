/**
 * One row in the playback queue. Metadata is a snapshot from catalog (`Child`) at enqueue time.
 */
export type PlayerQueueItem = {
  /** Stable list / reorder identity; duplicates the same `trackId` get distinct rowIds. */
  rowId: string;
  serverId: string;
  libraryId: string;
  trackId: string;
  serverUrl: string;
  username: string;
  title: string;
  artist?: string;
  album?: string;
  /** Subsonic track duration in seconds, when known */
  durationSeconds?: number;
  suffix?: string;
  bitRate?: number;
  coverArtId?: string;
  /** Snapshot of Subsonic star state when enqueued; updated when toggled from the player. */
  starred?: boolean;
};

export type PlayerViewState = {
  queue: readonly PlayerQueueItem[];
  currentIndex: number | null;
  currentItem: PlayerQueueItem | null;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  loadError: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  /** When true, skip next / end-of-track wraps to the first queue item (single-item queue restarts same track). */
  loopQueue: boolean;
  /** When true, natural end of track seeks to 0 and continues playing (checked before queue advance). */
  loopOne: boolean;
  /** True when the current track is playing from a ready offline copy (not streaming). */
  playingFromLocalFile: boolean;
};
