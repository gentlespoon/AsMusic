import type { LibraryArtworkCacheRow } from '@asmusic/core';

export type CoverArtFailureReason =
  | 'missing_cover_art_id'
  | 'invalid_image_bytes'
  | 'network_not_ok'
  | 'network_error'
  | 'no_api_or_cache'
  | 'all_sources_exhausted'
  | 'image_decode_error'
  | 'unknown';

export type CoverArtLoadFailure = {
  coverArtId?: string;
  fallbackCoverArtId?: string;
  attemptedId?: string;
  reason: CoverArtFailureReason;
  detail?: string;
  error?: unknown;
};

export const COVER_ART_SOURCE_ORDER = [
  'disk',
  'network_fetch',
  'local_file',
  'network_url',
] as const;

export type CoverArtSourceKind = (typeof COVER_ART_SOURCE_ORDER)[number];

export type CoverArtSources = {
  readDisk: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  fetchNetwork?: (
    coverArtId: string,
  ) => Promise<{ data: Uint8Array; mimeType: string } | null>;
  readLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  buildNetworkUrl?: (coverArtId: string) => string | null;
  persistNetwork?: (
    coverArtId: string,
    row: { data: Uint8Array; mimeType: string },
  ) => Promise<void>;
};

export type CoverArtResolved =
  | { kind: 'disk'; coverArtId: string; data: Uint8Array; mimeType: string }
  | {
      kind: 'network_fetch';
      coverArtId: string;
      data: Uint8Array;
      mimeType: string;
    }
  | {
      kind: 'local_file';
      coverArtId: string;
      localFilePath: string;
      mimeType: string;
    }
  | { kind: 'network_url'; coverArtId: string; url: string }
  | { kind: 'placeholder' }
  | { kind: 'unavailable'; failures: CoverArtLoadFailure[] };

export type ResolveCoverArtOptions = {
  validateNetworkBytes?: boolean;
  /** When set, logged once if resolution fails entirely. */
  logContext?: Pick<CoverArtLoadFailure, 'coverArtId' | 'fallbackCoverArtId' | 'detail'>;
};
