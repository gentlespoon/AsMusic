import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';
import type { SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';
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
  /** Increment when this id was written to local cache so the image reloads from storage. */
  artworkCacheBump?: number;
  /** Scope/library disambiguator for multi-library artwork caches. */
  artworkCacheKey?: string;
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
  artworkCacheBump = 0,
  artworkCacheKey,
  size = 128,
  sx,
  label,
}: Props) {
  const resolveCachedArtworkRef = useRef(resolveCachedArtwork);
  resolveCachedArtworkRef.current = resolveCachedArtwork;

  const cacheKey =
    coverArtId && (api || artworkCacheKey)
      ? buildCoverArtCacheKey(coverArtId, size, artworkCacheBump, { api, artworkCacheKey })
      : null;

  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? peekCoverArtUrl(cacheKey) : null,
  );

  useEffect(() => {
    if (!coverArtId || !cacheKey) {
      setSrc(null);
      return;
    }

    let cancelled = false;
    const cached = acquireCoverArtUrl(cacheKey);
    if (cached) {
      setSrc(cached);
    }

    void getOrStartCoverArtLoad(cacheKey, async () => {
      try {
        let blob: Blob | null = null;
        const resolve = resolveCachedArtworkRef.current;
        const fromDisk = resolve ? await resolve(coverArtId) : null;
        if (fromDisk?.data?.byteLength) {
          blob = new Blob([fromDisk.data], { type: fromDisk.mimeType || 'image/jpeg' });
        } else if (api) {
          const res = await api.getCoverArt({ id: coverArtId, size });
          if (!res.ok) return null;
          blob = await res.blob();
        }
        if (!blob) return null;
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    }).then((url) => {
      if (!cancelled && url) {
        setSrc(url);
      }
    });

    return () => {
      cancelled = true;
      releaseCoverArtUrl(cacheKey);
    };
  }, [api, cacheKey, coverArtId, size, artworkCacheBump, artworkCacheKey]);

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
  if (!src) {
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
      src={src}
      alt={label ?? ''}
      sx={[baseCoverSx, { objectFit: 'cover' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
}
