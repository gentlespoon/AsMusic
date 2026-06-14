import type { SubsonicAPI } from '@asmusic/core';

type CacheEntry = {
  url: string;
  refCount: number;
  loading: Promise<string | null> | null;
  lastUsed: number;
};

const MAX_ENTRIES = 400;

const cache = new Map<string, CacheEntry>();
const apiKeys = new WeakMap<SubsonicAPI, string>();
let nextApiKey = 0;

export function getApiInstanceKey(api: SubsonicAPI): string {
  let key = apiKeys.get(api);
  if (!key) {
    key = String(++nextApiKey);
    apiKeys.set(api, key);
  }
  return key;
}

export function buildCoverArtCacheKey(
  coverArtId: string,
  size: number,
  artworkCacheBump: number,
  context: { api?: SubsonicAPI | null; artworkCacheKey?: string },
): string | null {
  const { api, artworkCacheKey } = context;
  const ownerKey = api
    ? getApiInstanceKey(api)
    : artworkCacheKey
      ? `local:${artworkCacheKey}`
      : null;
  if (!ownerKey) return null;
  return [ownerKey, artworkCacheKey ?? '', coverArtId, String(size), String(artworkCacheBump)].join('|');
}

export function peekCoverArtUrl(key: string): string | null {
  const entry = cache.get(key);
  if (!entry?.url) return null;
  entry.lastUsed = Date.now();
  return entry.url;
}

export function acquireCoverArtUrl(key: string): string | null {
  let entry = cache.get(key);
  if (!entry) {
    entry = { url: '', refCount: 0, loading: null, lastUsed: Date.now() };
    cache.set(key, entry);
  }
  entry.refCount += 1;
  entry.lastUsed = Date.now();
  return entry.url || null;
}

export function releaseCoverArtUrl(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastUsed = Date.now();
  evictIfNeeded();
}

export function getOrStartCoverArtLoad(
  key: string,
  load: () => Promise<string | null>,
): Promise<string | null> {
  const entry = cache.get(key);
  if (entry?.url) {
    entry.lastUsed = Date.now();
    return Promise.resolve(entry.url);
  }
  if (entry?.loading) {
    return entry.loading;
  }

  const loading = load()
    .then((url) => {
      const current = cache.get(key);
      if (!current) return url;
      current.loading = null;
      if (url) {
        if (current.url && current.url !== url) {
          URL.revokeObjectURL(current.url);
        }
        current.url = url;
        current.lastUsed = Date.now();
      }
      evictIfNeeded();
      return url;
    })
    .catch(() => {
      const current = cache.get(key);
      if (current) current.loading = null;
      return null;
    });

  if (entry) {
    entry.loading = loading;
  } else {
    cache.set(key, { url: '', refCount: 0, loading, lastUsed: Date.now() });
  }
  return loading;
}

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;

  const evictable = [...cache.entries()]
    .filter(([, entry]) => entry.refCount === 0 && entry.url)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  for (const [key, entry] of evictable) {
    if (cache.size <= MAX_ENTRIES) break;
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }
}
