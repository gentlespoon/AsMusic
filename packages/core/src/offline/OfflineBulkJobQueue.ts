import type { OfflineMediaKey } from './OfflineMediaStore';
import type { OfflineMediaStore } from './OfflineMediaStore';

export type OfflineBulkJobKind = 'album' | 'playlist' | 'tracks';

export type OfflineBulkJobState = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type OfflineBulkJobTrack = {
  key: OfflineMediaKey;
  streamUrl: string;
};

export type OfflineBulkJob = {
  id: string;
  kind: OfflineBulkJobKind;
  label: string;
  state: OfflineBulkJobState;
  tracks: OfflineBulkJobTrack[];
  /** Indices into `tracks` */
  completedIndices: Set<number>;
  failedIndices: Set<number>;
  currentIndex: number | null;
  createdAt: number;
  errorMessage?: string;
};

export type OfflineBulkJobQueueSnapshot = {
  jobs: OfflineBulkJob[];
  pausedGlobally: boolean;
};

type Listener = (s: OfflineBulkJobQueueSnapshot) => void;

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * In-memory bulk download scheduler. Persists only via `OfflineMediaStore` per track.
 * Downloads run one at a time; re-entrant `pump()` calls never start overlapping imports.
 */
export class OfflineBulkJobQueue {
  private jobs: OfflineBulkJob[] = [];
  private pausedGlobally = false;
  private listeners = new Set<Listener>();
  private pumping = false;
  private pumpRequested = false;

  constructor(private readonly offline: OfflineMediaStore) {}

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  snapshot(): OfflineBulkJobQueueSnapshot {
    return { jobs: this.jobs.map((j) => ({ ...j, completedIndices: new Set(j.completedIndices), failedIndices: new Set(j.failedIndices) })), pausedGlobally: this.pausedGlobally };
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  enqueue(job: Omit<OfflineBulkJob, 'id' | 'state' | 'completedIndices' | 'failedIndices' | 'currentIndex' | 'createdAt'>): string {
    const id = randomId();
    const full: OfflineBulkJob = {
      ...job,
      id,
      state: job.tracks.length === 0 ? 'completed' : 'pending',
      completedIndices: new Set(),
      failedIndices: new Set(),
      currentIndex: null,
      createdAt: Date.now(),
    };
    this.jobs.push(full);
    this.emit();
    void this.pump();
    return id;
  }

  setPausedGlobally(paused: boolean) {
    this.pausedGlobally = paused;
    this.emit();
    if (!paused) void this.pump();
  }

  cancelJob(jobId: string) {
    const j = this.jobs.find((x) => x.id === jobId);
    if (!j) return;
    if (j.state === 'completed' || j.state === 'cancelled') return;
    j.state = 'cancelled';
    j.currentIndex = null;
    this.emit();
    void this.pump();
  }

  cancelAll() {
    for (const j of this.jobs) {
      if (j.state !== 'completed' && j.state !== 'cancelled') {
        j.state = 'cancelled';
        j.currentIndex = null;
      }
    }
    this.emit();
  }

  removePendingJob(jobId: string) {
    const idx = this.jobs.findIndex((x) => x.id === jobId);
    if (idx < 0) return;
    const j = this.jobs[idx]!;
    if (j.state !== 'pending') return;
    this.jobs.splice(idx, 1);
    this.emit();
  }

  moveJob(jobId: string, delta: -1 | 1) {
    const idx = this.jobs.findIndex((x) => x.id === jobId);
    if (idx < 0) return;
    const j = this.jobs[idx]!;
    if (j.state !== 'pending') return;
    const next = idx + delta;
    if (next < 0 || next >= this.jobs.length) return;
    const other = this.jobs[next]!;
    if (other.state !== 'pending') return;
    this.jobs[idx] = other;
    this.jobs[next] = j;
    this.emit();
  }

  async retryFailedTracks(jobId: string) {
    const j = this.jobs.find((x) => x.id === jobId);
    if (!j || j.failedIndices.size === 0) return;
    for (const i of j.failedIndices) {
      j.failedIndices.delete(i);
    }
    if (j.state === 'failed' || j.state === 'completed') {
      j.state = j.tracks.length === 0 ? 'completed' : 'pending';
      j.errorMessage = undefined;
    }
    this.emit();
    void this.pump();
  }

  private async pump() {
    this.pumpRequested = true;
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.pumpRequested) {
        this.pumpRequested = false;
        while (!this.pausedGlobally) {
          const job = this.jobs.find((j) => j.state === 'pending' || j.state === 'running');
          if (!job) break;
          if (job.state === 'pending') {
            job.state = 'running';
            this.emit();
          }
          if (job.state !== 'running') continue;

          const nextIdx = job.tracks.findIndex(
            (_t, i) => !job.completedIndices.has(i) && !job.failedIndices.has(i)
          );
          if (nextIdx < 0) {
            job.state = job.failedIndices.size > 0 && job.completedIndices.size === 0 ? 'failed' : 'completed';
            job.currentIndex = null;
            if (job.state === 'failed' && !job.errorMessage) {
              job.errorMessage = 'One or more tracks failed to download';
            }
            this.emit();
            continue;
          }

          job.currentIndex = nextIdx;
          this.emit();

          const isCancelled = () =>
            this.jobs.some((x) => x.id === job.id && x.state === 'cancelled');

          const { key, streamUrl } = job.tracks[nextIdx]!;
          try {
            if (isCancelled()) continue;
            await this.offline.importFromAuthenticatedUrl(key, streamUrl);
            if (isCancelled()) continue;
            job.completedIndices.add(nextIdx);
          } catch (e) {
            if (isCancelled()) continue;
            job.failedIndices.add(nextIdx);
            job.errorMessage = e instanceof Error ? e.message : 'Download failed';
          }
          job.currentIndex = null;
          this.emit();
        }
      }
    } finally {
      this.pumping = false;
    }
    if (this.pumpRequested) {
      void this.pump();
    }
  }
}
