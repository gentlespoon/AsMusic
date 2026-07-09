import type { PlatformKind } from '@asmusic/core';
import { getDefaultCoverArtPlaceholderBase64 } from './placeholder.ts';
import type { CoverArtResolved } from './types.ts';

export type NowPlayingArtwork = {
  artworkUrl?: string;
  artworkDataBase64?: string;
  artworkPlaceholderDataBase64: string;
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function placeholderArtwork(): NowPlayingArtwork {
  const artworkDataBase64 = getDefaultCoverArtPlaceholderBase64();
  return {
    artworkDataBase64,
    artworkPlaceholderDataBase64: artworkDataBase64,
  };
}

/** Map resolver output to lock-screen / Control Center artwork fields. */
export function toNowPlayingArtwork(
  resolved: CoverArtResolved,
  hostKind: PlatformKind,
): NowPlayingArtwork {
  const placeholder = getDefaultCoverArtPlaceholderBase64();

  switch (resolved.kind) {
    case 'disk':
    case 'network_fetch':
      if (hostKind === 'ios-capacitor') {
        return {
          artworkDataBase64: uint8ArrayToBase64(resolved.data),
          artworkPlaceholderDataBase64: placeholder,
        };
      }
      return {
        artworkUrl: undefined,
        artworkDataBase64: undefined,
        artworkPlaceholderDataBase64: placeholder,
      };
    case 'network_url':
      return {
        artworkUrl: resolved.url,
        artworkPlaceholderDataBase64: placeholder,
      };
    case 'local_file':
      return {
        artworkPlaceholderDataBase64: placeholder,
      };
    case 'placeholder':
    case 'unavailable':
    default:
      return placeholderArtwork();
  }
}
