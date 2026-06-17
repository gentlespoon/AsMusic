import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';
import { CANONICAL_COVER_ART_SIZE, type SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';
import type { PersistCachedArtwork } from './libraryArtworkCacheAccess';
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
 */
export function CoverArtThumb({
  api,
  coverArtId,
  resolveCachedArtwork,
  resolveArtworkLocalFile,
  persistCachedArtwork,
  artworkCacheBump = 0,
  artworkCacheKey,
  sx,
  label,
}: Props) {
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

  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? peekCoverArtUrl(cacheKey) : null,
  );
  const srcCacheKeyRef = useRef<string | null>(cacheKey);

  useEffect(() => {
    if (!coverArtId || !cacheKey) {
      srcCacheKeyRef.current = null;
      setSrc(null);
      return;
    }

    let cancelled = false;
    srcCacheKeyRef.current = cacheKey;
    const cached = acquireCoverArtUrl(cacheKey);
    setSrc(cached);

    void getOrStartCoverArtLoad(cacheKey, async () => {
      try {
        const resolveLocal = resolveArtworkLocalFileRef.current;
        if (resolveLocal) {
          const local = await resolveLocal(coverArtId);
          if (local?.localFilePath) {
            return Capacitor.convertFileSrc(local.localFilePath);
          }
        }

        let blob: Blob | null = null;
        const resolve = resolveCachedArtworkRef.current;
        const fromDisk = resolve ? await resolve(coverArtId) : null;
        if (fromDisk?.data?.byteLength) {
          blob = new Blob([fromDisk.data], { type: fromDisk.mimeType || 'image/jpeg' });
        } else if (api) {
          const res = await api.getCoverArt({ id: coverArtId, size: CANONICAL_COVER_ART_SIZE });
          if (!res.ok) return null;
          blob = await res.blob();
          const persist = persistCachedArtworkRef.current;
          if (persist && blob.size > 0) {
            const mimeType = blob.type?.split(';')[0]?.trim() || 'image/jpeg';
            void persist(coverArtId, {
              data: new Uint8Array(await blob.arrayBuffer()),
              mimeType,
            }).catch(() => undefined);
          }
        }
        if (!blob) return null;
        return URL.createObjectURL(blob);
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
  }, [api, cacheKey, coverArtId, artworkCacheBump, artworkCacheKey]);

  const displaySrc = srcCacheKeyRef.current === cacheKey ? src : null;

  if (!coverArtId) {
    return (
      <Box
        aria-hidden
        sx={[
          baseCoverSx,
          {
            background: (theme) => coverPlaceholderGradient(theme),
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    );
  }
  if (!displaySrc) {
    return (
      <Box
        aria-hidden
        sx={[
          baseCoverSx,
          {
            background: (theme) => coverPlaceholderGradient(theme),
            animation: `${pulse} 1.2s ease-in-out infinite`,
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    );
  }
  return (
    <Box
      component="img"
      src={displaySrc}
      alt={label ?? ''}
      sx={[baseCoverSx, { objectFit: 'cover' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
}
