import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';
import { CANONICAL_COVER_ART_SIZE, type SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';
import type { PersistCachedArtwork } from './libraryArtworkCacheAccess';
import { artworkDisplayMimeType, isValidImageBytes } from './artworkDisplayMimeType';
import {
  acquireCoverArtUrl,
  buildCoverArtCacheKey,
  getOrStartCoverArtLoad,
  peekCoverArtUrl,
  releaseCoverArtUrl,
} from './coverArtObjectUrlCache';

const pulse = keyframes`
  50% { opacity: 0.65; }
`;

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

function coverPlaceholderGradient(theme: Theme): string {
  if (theme.palette.mode === 'light') {
    return `linear-gradient(135deg, ${theme.palette.grey[200]} 0%, ${theme.palette.grey[400]} 100%)`;
  }
  return `linear-gradient(135deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 100%)`;
}

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
  const srcCacheKeyRef = useRef<string | null>(cacheKey);

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
      return;
    }

    let cancelled = false;
    srcCacheKeyRef.current = cacheKey;
    const cached = acquireCoverArtUrl(cacheKey);
    setSrc(cached);

    const fallbackId = fallbackCoverArtId?.trim();
    const idsToTry = [coverArtId];
    if (fallbackId && fallbackId !== coverArtId) {
      idsToTry.push(fallbackId);
    }

    void getOrStartCoverArtLoad(cacheKey, async () => {
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
            if (!isValidImageBytes(fromDisk.data)) continue;
            const mimeType = artworkDisplayMimeType(fromDisk.data, fromDisk.mimeType);
            blob = new Blob([fromDisk.data], { type: mimeType });
          } else if (api) {
            const res = await api.getCoverArt({ id, size: CANONICAL_COVER_ART_SIZE });
            if (cancelled) return null;
            if (res.ok) {
              const raw = new Uint8Array(await res.arrayBuffer());
              if (cancelled) return null;
              if (!isValidImageBytes(raw)) continue;
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
            }
          }
          if (!blob) continue;
          return URL.createObjectURL(blob);
        }
        return null;
      } catch {
        return null;
      }
    }).then((url) => {
      if (!cancelled && url) {
        srcCacheKeyRef.current = cacheKey;
        setSrc(url);
      }
    });

    return () => {
      cancelled = true;
      releaseCoverArtUrl(cacheKey);
    };
  }, [api, cacheKey, coverArtId, fallbackCoverArtId, artworkCacheBump, artworkCacheKey, inView]);

  const displaySrc = srcCacheKeyRef.current === cacheKey ? src : null;
  const combinedSx = [...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

  if (!coverArtId) {
    return (
      <Box
        ref={rootRef}
        aria-hidden
        sx={[
          baseCoverSx,
          {
            background: (theme) => coverPlaceholderGradient(theme),
          },
          ...combinedSx,
        ]}
      />
    );
  }
  if (!displaySrc) {
    return (
      <Box
        ref={rootRef}
        aria-hidden
        sx={[
          baseCoverSx,
          {
            background: (theme) => coverPlaceholderGradient(theme),
            animation: inView ? `${pulse} 1.2s ease-in-out infinite` : undefined,
          },
          ...combinedSx,
        ]}
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
    />
  );
}
