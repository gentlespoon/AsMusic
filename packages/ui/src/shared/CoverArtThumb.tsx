import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  COVER_ART_THUMB_ROOT_MARGIN_Y_PX,
  findCoverArtScrollRoot,
  isCoverArtThumbIntersecting,
} from './coverArt/coverArtThumbVisibility';
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
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    setRootEl(node);
  }, []);
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
  const [loadRetryNonce, setLoadRetryNonce] = useState(0);
  const prevApiRef = useRef(api);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    const hadApi = Boolean(prevApiRef.current);
    prevApiRef.current = api;
    if (!hadApi && api && inView && loadState !== 'ready' && loadState !== 'loading') {
      setLoadRetryNonce((n) => n + 1);
    }
  }, [api, coverArtId, inView, loadState]);

  useEffect(() => {
    usedNetworkUrlFallbackRef.current = false;
  }, [cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey]);

  useLayoutEffect(() => {
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
    if (!rootEl) return;

    // Virtuoso recycles row components: reset until this id is near the viewport.
    setInView(false);

    const scrollRoot = findCoverArtScrollRoot(rootEl);
    const intersectionOptions = {
      root: scrollRoot,
      rootMarginYPx: COVER_ART_THUMB_ROOT_MARGIN_Y_PX,
    };
    const syncHit = isCoverArtThumbIntersecting(rootEl, intersectionOptions);

    let visible = false;
    const markVisible = () => {
      if (visible) return;
      visible = true;
      setInView(true);
    };

    if (syncHit) {
      markVisible();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting || e.intersectionRatio > 0);
        if (hit) {
          markVisible();
          io.disconnect();
        }
      },
      {
        root: scrollRoot,
        rootMargin: `${COVER_ART_THUMB_ROOT_MARGIN_Y_PX}px 0px`,
        threshold: 0,
      },
    );
    io.observe(rootEl);

    // Virtuoso may mount rows before the scroller has its final height on cold start.
    let raf = 0;
    const recheckAfterLayout = () => {
      raf = requestAnimationFrame(() => {
        if (visible) return;
        if (isCoverArtThumbIntersecting(rootEl, intersectionOptions)) {
          markVisible();
          io.disconnect();
        }
      });
    };
    recheckAfterLayout();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [cacheKey, coverArtId, loadImmediately, rootEl]);

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
    const loadGeneration = ++loadGenerationRef.current;
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
      if (cancelled || loadGeneration !== loadGenerationRef.current) return;
      if (url) {
        srcCacheKeyRef.current = cacheKey;
        setSrc(url);
        setLoadState('ready');
        return;
      }
      setSrc(null);
      // Stay idle when network is not wired yet so apiRetry can re-run the load.
      if (!sourcesRef.current.fetchNetwork) {
        setLoadState('idle');
        return;
      }
      setLoadState('failed');
    });

    return () => {
      cancelled = true;
      releaseCoverArtUrl(cacheKey);
    };
  }, [cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey, inView, loadRetryNonce]);

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
    return <CoverArtPlaceholder ref={setRootRef} label={label} sx={combinedSx} />;
  }

  if (loadState !== 'ready' || !displaySrc) {
    return (
      <CoverArtPlaceholder
        ref={setRootRef}
        label={label}
        loading={loadState === 'loading'}
        sx={combinedSx}
      />
    );
  }

  return (
    <Box
      ref={setRootRef}
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
