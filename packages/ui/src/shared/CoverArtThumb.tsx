import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';
import type { PersistCachedArtwork } from './libraryArtworkCacheAccess';
import { CoverArtPlaceholder } from './CoverArtPlaceholder';
import {
  buildCoverArtSourcesFromThumbProps,
  logCoverArtUnavailable,
  resolveCoverArt,
  toThumbDisplayUrl,
  type CoverArtSources,
} from './coverArt';
import {
  acquireCoverArtUrl,
  buildCoverArtCacheKey,
  getOrStartCoverArtLoad,
  invalidateCoverArtUrl,
  peekCoverArtUrl,
  releaseCoverArtUrl,
} from './coverArtObjectUrlCache';

type Props = {
  /** Prebuilt resolver sources (preferred over individual callbacks). */
  sources?: CoverArtSources;
  /** When omitted, cover art loads from `resolveCachedArtwork` only (offline-safe). */
  api?: SubsonicAPI | null;
  coverArtId?: string;
  /** When set, disk/database cache is tried before hitting the network. */
  resolveCachedArtwork?: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  /** iOS-native fast path: local file path for cached artwork. */
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  /**
   * Authenticated cover-art URL (e.g. `getCoverArt.view` with token params).
   * Matches the lock-screen fallback when blob/local paths fail in the WebView.
   */
  resolveCoverArtNetworkUrl?: (coverArtId: string) => string | null;
  /** When set with `resolveCachedArtwork`, successful network fetches are written here. */
  persistCachedArtwork?: PersistCachedArtwork;
  /** Increment when this id was written to local cache so the image reloads from storage. */
  artworkCacheBump?: number;
  /** Scope/library disambiguator for multi-library artwork caches. */
  artworkCacheKey?: string;
  /** When the primary `coverArtId` cannot be loaded, try this id (e.g. album art). */
  fallbackCoverArtId?: string;
  /** Skip viewport lazy-load (player chrome is always on-screen). */
  loadImmediately?: boolean;
  /** Display-only hint (network always uses canonical 512px fetch). */
  size?: number;
  sx?: SxProps<Theme>;
  label?: string;
};

const baseCoverSx: SxProps<Theme> = {
  display: 'block',
  width: '100%',
  height: '100%',
};

function isNetworkImageUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Loads cover art through the authenticated Subsonic client (works for Navidrome
 * token auth and standard password token/salt URLs).
 *
 * Network + disk work starts only after the thumb intersects the viewport (or has a
 * warm in-memory URL), so background tabs / off-screen Virtuoso rows do not flood
 * native artwork writes during library refresh.
 */
export function CoverArtThumb({
  sources: sourcesProp,
  api,
  coverArtId,
  fallbackCoverArtId,
  resolveCachedArtwork,
  resolveArtworkLocalFile,
  resolveCoverArtNetworkUrl,
  persistCachedArtwork,
  artworkCacheBump = 0,
  artworkCacheKey,
  loadImmediately = false,
  sx,
  label,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sources = useMemo(
    () =>
      sourcesProp ??
      buildCoverArtSourcesFromThumbProps({
        api,
        resolveCachedArtwork,
        resolveArtworkLocalFile,
        resolveCoverArtNetworkUrl,
        persistCachedArtwork,
      }),
    [
      sourcesProp,
      api,
      resolveCachedArtwork,
      resolveArtworkLocalFile,
      resolveCoverArtNetworkUrl,
      persistCachedArtwork,
    ],
  );
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const cacheKey =
    coverArtId && (api || artworkCacheKey)
      ? buildCoverArtCacheKey(coverArtId, artworkCacheBump, { api, artworkCacheKey })
      : null;

  const [inView, setInView] = useState(
    () => loadImmediately || (cacheKey ? Boolean(peekCoverArtUrl(cacheKey)) : false),
  );
  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? peekCoverArtUrl(cacheKey) : null,
  );
  const [loadState, setLoadState] = useState<LoadState>(() =>
    cacheKey && peekCoverArtUrl(cacheKey) ? 'ready' : 'idle',
  );
  const srcCacheKeyRef = useRef<string | null>(cacheKey);
  const usedNetworkUrlFallbackRef = useRef(false);

  useEffect(() => {
    usedNetworkUrlFallbackRef.current = false;
  }, [cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey]);

  useEffect(() => {
    if (loadImmediately) {
      setInView(true);
      return;
    }

    if (!coverArtId || !cacheKey) {
      setInView(false);
      return;
    }
    if (peekCoverArtUrl(cacheKey)) {
      setInView(true);
      return;
    }

    setInView(false);

    const el = rootRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    let visible = false;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting || e.intersectionRatio > 0);
        if (hit && !visible) {
          visible = true;
          setInView(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: '120px 0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cacheKey, coverArtId, loadImmediately]);

  useEffect(() => {
    if (!coverArtId || !cacheKey || !inView) {
      srcCacheKeyRef.current = null;
      setSrc(null);
      if (!coverArtId) {
        setLoadState('failed');
      } else if (!inView) {
        setLoadState('idle');
      }
      return;
    }

    let cancelled = false;
    srcCacheKeyRef.current = cacheKey;
    const cached = acquireCoverArtUrl(cacheKey);
    if (cached) {
      setSrc(cached);
      setLoadState('ready');
    } else {
      setSrc(null);
      setLoadState('loading');
    }

    const fallbackId = fallbackCoverArtId?.trim();
    const idsToTry = [coverArtId];
    if (fallbackId && fallbackId !== coverArtId) {
      idsToTry.push(fallbackId);
    }

    void getOrStartCoverArtLoad(cacheKey, async () => {
      if (cancelled) return null;
      const resolved = await resolveCoverArt(idsToTry, sourcesRef.current, {
        logContext: { coverArtId, fallbackCoverArtId: fallbackId },
      });
      if (cancelled) return null;
      if (resolved.kind === 'unavailable' || resolved.kind === 'placeholder') {
        return null;
      }
      return toThumbDisplayUrl(resolved);
    }).then((url) => {
      if (cancelled) return;
      if (url) {
        srcCacheKeyRef.current = cacheKey;
        setSrc(url);
        setLoadState('ready');
        return;
      }
      setSrc(null);
      setLoadState('failed');
    });

    return () => {
      cancelled = true;
      releaseCoverArtUrl(cacheKey);
    };
  }, [api, cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey, inView, sources]);

  const displaySrc = srcCacheKeyRef.current === cacheKey ? src : null;
  const combinedSx = [...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

  const tryNetworkUrlFallback = () => {
    if (usedNetworkUrlFallbackRef.current) return false;
    const buildUrl = sourcesRef.current.buildNetworkUrl;
    if (!buildUrl) return false;

    const ids = [coverArtId, fallbackCoverArtId?.trim()].filter(
      (id): id is string => Boolean(id?.trim()),
    );
    const seen = new Set<string>();
    for (const id of ids) {
      const trimmed = id.trim();
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      const url = buildUrl(trimmed);
      if (!url) continue;
      usedNetworkUrlFallbackRef.current = true;
      if (cacheKey) invalidateCoverArtUrl(cacheKey);
      setSrc(url);
      setLoadState('ready');
      return true;
    }
    return false;
  };

  if (!coverArtId || loadState === 'failed') {
    return <CoverArtPlaceholder ref={rootRef} label={label} sx={combinedSx} />;
  }

  if (loadState !== 'ready' || !displaySrc) {
    return (
      <CoverArtPlaceholder
        ref={rootRef}
        label={label}
        loading={loadState === 'loading'}
        sx={combinedSx}
      />
    );
  }

  return (
    <Box
      ref={rootRef}
      component="img"
      src={displaySrc}
      alt={label ?? ''}
      sx={[baseCoverSx, { objectFit: 'cover' }, ...combinedSx]}
      onError={() => {
        if (
          displaySrc &&
          !isNetworkImageUrl(displaySrc) &&
          tryNetworkUrlFallback()
        ) {
          logCoverArtUnavailable({
            coverArtId,
            fallbackCoverArtId: fallbackCoverArtId?.trim(),
            reason: 'image_decode_error',
            detail: `recovered via network URL after ${displaySrc}`,
          });
          return;
        }
        logCoverArtUnavailable({
          coverArtId,
          fallbackCoverArtId: fallbackCoverArtId?.trim(),
          reason: 'image_decode_error',
          detail: displaySrc,
        });
        if (cacheKey) invalidateCoverArtUrl(cacheKey);
        setSrc(null);
        setLoadState('failed');
      }}
    />
  );
}
