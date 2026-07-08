import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { CANONICAL_COVER_ART_SIZE, type SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';
import type { PersistCachedArtwork } from './libraryArtworkCacheAccess';
import { artworkDisplayMimeType, isValidImageBytes } from './artworkDisplayMimeType';
import { CoverArtPlaceholder } from './CoverArtPlaceholder';
import type { CoverArtFailureReason } from './defaultCoverArtPlaceholder';
import {
  logCoverArtUnavailable,
} from './defaultCoverArtPlaceholder';
import {
  acquireCoverArtUrl,
  buildCoverArtCacheKey,
  getOrStartCoverArtLoad,
  peekCoverArtUrl,
  releaseCoverArtUrl,
} from './coverArtObjectUrlCache';

type Props = {
  /** When omitted, cover art loads from `resolveCachedArtwork` only (offline-safe). */
  api?: SubsonicAPI | null;
  coverArtId?: string;
  /** When set, disk/database cache is tried before hitting the network. */
  resolveCachedArtwork?: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  /** iOS-native fast path: local file path for cached artwork. */
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  /** When set with `resolveCachedArtwork`, successful network fetches are written here. */
  persistCachedArtwork?: PersistCachedArtwork;
  /** Increment when this id was written to local cache so the image reloads from storage. */
  artworkCacheBump?: number;
  /** Scope/library disambiguator for multi-library artwork caches. */
  artworkCacheKey?: string;
  /** When the primary `coverArtId` cannot be loaded, try this id (e.g. album art). */
  fallbackCoverArtId?: string;
  /** Display-only hint (network always uses {@link CANONICAL_COVER_ART_SIZE}). */
  size?: number;
  sx?: SxProps<Theme>;
  label?: string;
};

const baseCoverSx: SxProps<Theme> = {
  display: 'block',
  width: '100%',
  height: '100%',
};

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
  api,
  coverArtId,
  fallbackCoverArtId,
  resolveCachedArtwork,
  resolveArtworkLocalFile,
  persistCachedArtwork,
  artworkCacheBump = 0,
  artworkCacheKey,
  sx,
  label,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const resolveCachedArtworkRef = useRef(resolveCachedArtwork);
  resolveCachedArtworkRef.current = resolveCachedArtwork;
  const resolveArtworkLocalFileRef = useRef(resolveArtworkLocalFile);
  resolveArtworkLocalFileRef.current = resolveArtworkLocalFile;
  const persistCachedArtworkRef = useRef(persistCachedArtwork);
  persistCachedArtworkRef.current = persistCachedArtwork;

  const cacheKey =
    coverArtId && (api || artworkCacheKey)
      ? buildCoverArtCacheKey(coverArtId, artworkCacheBump, { api, artworkCacheKey })
      : null;

  const [inView, setInView] = useState(() => (cacheKey ? Boolean(peekCoverArtUrl(cacheKey)) : false));
  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? peekCoverArtUrl(cacheKey) : null,
  );
  const [loadState, setLoadState] = useState<LoadState>(() =>
    cacheKey && peekCoverArtUrl(cacheKey) ? 'ready' : 'idle',
  );
  const srcCacheKeyRef = useRef<string | null>(cacheKey);
  const loggedFailureRef = useRef(false);

  useEffect(() => {
    loggedFailureRef.current = false;
  }, [cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey]);

  useEffect(() => {
    if (!coverArtId || !cacheKey) {
      setInView(false);
      return;
    }
    if (peekCoverArtUrl(cacheKey)) {
      setInView(true);
      return;
    }

    // Virtuoso recycles row components: reset until this id is near the viewport.
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
  }, [cacheKey, coverArtId]);

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

    const reportFailure = (
      reason: CoverArtFailureReason,
      extra?: { attemptedId?: string; detail?: string; error?: unknown },
    ) => {
      if (loggedFailureRef.current) return;
      loggedFailureRef.current = true;
      logCoverArtUnavailable({
        coverArtId,
        fallbackCoverArtId: fallbackId,
        reason,
        ...extra,
      });
    };

    void getOrStartCoverArtLoad(cacheKey, async () => {
      const failures: Array<{ attemptedId: string; reason: CoverArtFailureReason; detail?: string }> =
        [];

      try {
        for (const id of idsToTry) {
          if (cancelled) return null;

          const resolveLocal = resolveArtworkLocalFileRef.current;
          if (resolveLocal) {
            const local = await resolveLocal(id);
            if (cancelled) return null;
            if (local?.localFilePath) {
              return Capacitor.convertFileSrc(local.localFilePath);
            }
          }

          let blob: Blob | null = null;
          const resolve = resolveCachedArtworkRef.current;
          const fromDisk = resolve ? await resolve(id) : null;
          if (cancelled) return null;
          if (fromDisk?.data?.byteLength) {
            if (!isValidImageBytes(fromDisk.data)) {
              failures.push({ attemptedId: id, reason: 'invalid_image_bytes' });
              continue;
            }
            const mimeType = artworkDisplayMimeType(fromDisk.data, fromDisk.mimeType);
            blob = new Blob([fromDisk.data], { type: mimeType });
          } else if (api) {
            try {
              const res = await api.getCoverArt({ id, size: CANONICAL_COVER_ART_SIZE });
              if (cancelled) return null;
              if (res.ok) {
                const raw = new Uint8Array(await res.arrayBuffer());
                if (cancelled) return null;
                if (!isValidImageBytes(raw)) {
                  failures.push({ attemptedId: id, reason: 'invalid_image_bytes' });
                  continue;
                }
                const mimeType = artworkDisplayMimeType(
                  raw,
                  res.headers.get('content-type') ?? undefined,
                );
                const persist = persistCachedArtworkRef.current;
                if (persist && !cancelled) {
                  // Persist the id that actually loaded (may be the album fallback).
                  void persist(id, { data: raw, mimeType }).catch(() => undefined);
                }
                blob = new Blob([raw], { type: mimeType });
              } else {
                failures.push({
                  attemptedId: id,
                  reason: 'network_not_ok',
                  detail: `HTTP ${res.status}`,
                });
              }
            } catch (error) {
              failures.push({
                attemptedId: id,
                reason: 'network_error',
                detail: error instanceof Error ? error.message : String(error),
              });
            }
          } else if (!resolve) {
            failures.push({ attemptedId: id, reason: 'no_api_or_cache' });
          }

          if (!blob) continue;
          return URL.createObjectURL(blob);
        }

        reportFailure('all_sources_exhausted', {
          detail: failures
            .map((f) => `${f.attemptedId}:${f.reason}${f.detail ? `(${f.detail})` : ''}`)
            .join(', '),
        });
        return null;
      } catch (error) {
        reportFailure('unknown', { error });
        return null;
      }
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
  }, [api, cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey, inView]);

  const displaySrc = srcCacheKeyRef.current === cacheKey ? src : null;
  const combinedSx = [...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

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
        logCoverArtUnavailable({
          coverArtId,
          fallbackCoverArtId: fallbackCoverArtId?.trim(),
          reason: 'image_decode_error',
          detail: displaySrc,
        });
        setSrc(null);
        setLoadState('failed');
      }}
    />
  );
}
