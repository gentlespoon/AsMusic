import { describe, expect, it, vi } from 'vitest';
import { OfflineBulkJobQueue } from './OfflineBulkJobQueue';
import {
  createNoopOfflineMediaStore,
  type OfflineMediaKey,
  type OfflineMediaStore,
} from './OfflineMediaStore';

function trackKey(trackId: string): OfflineMediaKey {
  return {
    scope: { serverKey: 'server', libraryId: 'lib' },
    trackId,
    variant: 'mp3',
  };
}

function makeSlowStore(delayMs: number): OfflineMediaStore {
  const base = createNoopOfflineMediaStore();
  return {
    ...base,
    async importFromAuthenticatedUrl() {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    },
  };
}

describe('OfflineBulkJobQueue', () => {
  it('never runs overlapping imports when many jobs are enqueued during a download', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const base = createNoopOfflineMediaStore();
    let inflight = 0;
    let maxInflight = 0;
    const store: OfflineMediaStore = {
      ...base,
      async importFromAuthenticatedUrl() {
        started += 1;
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        try {
          if (started === 1) {
            await gate;
          } else {
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
          }
        } finally {
          inflight -= 1;
        }
      },
    };

    const queue = new OfflineBulkJobQueue(store);
    queue.enqueue({
      kind: 'tracks',
      label: 'a',
      tracks: [{ key: trackKey('1'), streamUrl: 'https://example.test/1' }],
    });
    queue.enqueue({
      kind: 'tracks',
      label: 'b',
      tracks: [{ key: trackKey('2'), streamUrl: 'https://example.test/2' }],
    });
    queue.enqueue({
      kind: 'tracks',
      label: 'c',
      tracks: [{ key: trackKey('3'), streamUrl: 'https://example.test/3' }],
    });

    await vi.waitFor(() => expect(started).toBe(1));
    expect(maxInflight).toBe(1);

    release();
    await vi.waitFor(() => {
      const snap = queue.snapshot();
      expect(snap.jobs.every((j) => j.state === 'completed')).toBe(true);
    });
    expect(maxInflight).toBe(1);
    expect(started).toBe(3);
  });

  it('continues remaining jobs after one job is cancelled mid-download', async () => {
    const store = makeSlowStore(20);
    const queue = new OfflineBulkJobQueue(store);
    const firstId = queue.enqueue({
      kind: 'tracks',
      label: 'first',
      tracks: [{ key: trackKey('1'), streamUrl: 'https://example.test/1' }],
    });
    queue.enqueue({
      kind: 'tracks',
      label: 'second',
      tracks: [{ key: trackKey('2'), streamUrl: 'https://example.test/2' }],
    });

    await vi.waitFor(() => {
      const snap = queue.snapshot();
      expect(snap.jobs.find((j) => j.id === firstId)?.state).toBe('running');
    });
    queue.cancelJob(firstId);

    await vi.waitFor(() => {
      const snap = queue.snapshot();
      expect(snap.jobs.find((j) => j.id === firstId)?.state).toBe('cancelled');
      expect(snap.jobs.find((j) => j.label === 'second')?.state).toBe('completed');
    });
  });
});
