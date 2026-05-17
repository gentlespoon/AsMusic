import type { SubsonicAPI } from '../api/client';
import type { LibraryCacheScope } from './cacheScope';
import type { LibraryArtworkCacheRow, LibraryCacheStorage } from './storage/LibraryCacheStorage';

const DEFAULT_MIME = 'image/jpeg';
const COVER_ART_SIZE = 320;
const DEFAULT_COVER_ART_REQUESTS_PER_SECOND = 5;

/** Limits how often workers may start a new HTTP request (avoids 429 during bulk cache). */
function createRequestRateLimiter(maxPerSecond: number): () => Promise<void> {
  const minIntervalMs = 1000 / maxPerSecond;
  let nextStartMs = 0;
  let chain = Promise.resolve();

  return () => {
    const ticket = chain.then(async () => {
      const now = Date.now();
      const startAt = Math.max(now, nextStartMs);
      nextStartMs = startAt + minIntervalMs;
      const delay = startAt - now;
      if (delay > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    });
    chain = ticket.catch(() => undefined);
    return ticket;
  };
}

async function runPoolVoid<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  async function runWorker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }
  if (items.length === 0) return;
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
}

/**
 * Downloads each cover id with bounded concurrency and request-rate throttling, then upserts into
 * {@link LibraryCacheStorage}. After each successful write, `onArtworkCached` runs so the UI can reload that cover.
 * Does not clear existing cache rows first, so previously cached art stays visible while new ids load.
 */
export async function runLibraryArtworkBackgroundCache(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: LibraryCacheScope,
  coverArtIds: string[],
  options?: {
    concurrency?: number;
    /** Max new cover-art HTTP requests started per second (default 5). */
    maxRequestsPerSecond?: number;
    onArtworkCached?: (coverArtId: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const concurrency = options?.concurrency ?? DEFAULT_COVER_ART_REQUESTS_PER_SECOND;
  const maxRequestsPerSecond = options?.maxRequestsPerSecond ?? DEFAULT_COVER_ART_REQUESTS_PER_SECOND;
  const onArtworkCached = options?.onArtworkCached;
  const signal = options?.signal;
  const acquireRequestSlot =
    maxRequestsPerSecond > 0 ? createRequestRateLimiter(maxRequestsPerSecond) : async () => undefined;

  if (signal?.aborted) return;

  await runPoolVoid(coverArtIds, concurrency, async (coverArtId) => {
    if (signal?.aborted) return;
    try {
      await acquireRequestSlot();
      if (signal?.aborted) return;
      const res = await api.getCoverArt({ id: coverArtId, size: COVER_ART_SIZE });
      if (signal?.aborted || !res.ok) return;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) return;
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || DEFAULT_MIME;
      if (signal?.aborted) return;
      const row: LibraryArtworkCacheRow = { coverArtId, data: buf, mimeType: mime };
      await storage.putArtworkBlob(scope, row);
      if (!signal?.aborted) {
        onArtworkCached?.(coverArtId);
      }
    } catch {
      /* ignore single-id failures */
    }
  });
}
