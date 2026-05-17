import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';
import type { SubsonicAPI } from '@asmusic/core';
import type { LibraryArtworkCacheRow } from '@asmusic/core';

const pulse = keyframes`
  50% { opacity: 0.65; }
`;

type Props = {
  api: SubsonicAPI;
  coverArtId?: string;
  /** When set, disk/database cache is tried before hitting the network. */
  resolveCachedArtwork?: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  /** Increment when this id was written to local cache so the image reloads from storage. */
  artworkCacheBump?: number;
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
  size = 128,
  sx,
  label,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const revoke = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!coverArtId) {
      revoke();
      setSrc(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        let blob: Blob | null = null;
        const cached = resolveCachedArtwork && coverArtId ? await resolveCachedArtwork(coverArtId) : null;
        if (cancelled) return;
        if (cached?.data?.byteLength) {
          blob = new Blob([cached.data], { type: cached.mimeType || 'image/jpeg' });
        } else {
          const res = await api.getCoverArt({ id: coverArtId, size });
          if (cancelled || !res.ok) return;
          blob = await res.blob();
        }
        if (cancelled || !blob) return;
        const u = URL.createObjectURL(blob);
        revoke();
        objectUrlRef.current = u;
        setSrc(u);
      } catch {
        if (!cancelled) {
          revoke();
          setSrc(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      revoke();
      setSrc(null);
    };
  }, [api, coverArtId, size, resolveCachedArtwork, artworkCacheBump]);

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
      loading="lazy"
      sx={[baseCoverSx, { objectFit: 'cover' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
}
