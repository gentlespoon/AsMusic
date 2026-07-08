import { artworkDisplayMimeType, isValidImageBytes } from './mimeType.ts';
import { logCoverArtUnavailable } from './placeholder.ts';
import type {
  CoverArtLoadFailure,
  CoverArtResolved,
  CoverArtSources,
  ResolveCoverArtOptions,
} from './types.ts';

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

async function tryDisk(
  coverArtId: string,
  sources: CoverArtSources,
): Promise<CoverArtResolved | null> {
  const row = await sources.readDisk(coverArtId);
  if (!row?.data?.byteLength) return null;
  const mimeType = artworkDisplayMimeType(row.data, row.mimeType);
  return { kind: 'disk', coverArtId, data: row.data, mimeType };
}

async function tryNetworkFetch(
  coverArtId: string,
  sources: CoverArtSources,
  validateNetworkBytes: boolean,
  failures: CoverArtLoadFailure[],
): Promise<CoverArtResolved | null> {
  if (!sources.fetchNetwork) return null;
  try {
    const fetched = await sources.fetchNetwork(coverArtId);
    if (!fetched) {
      failures.push({ attemptedId: coverArtId, reason: 'network_not_ok' });
      return null;
    }
    if (validateNetworkBytes && !isValidImageBytes(fetched.data)) {
      failures.push({ attemptedId: coverArtId, reason: 'invalid_image_bytes' });
      return null;
    }
    if (sources.persistNetwork) {
      void sources.persistNetwork(coverArtId, fetched).catch(() => undefined);
    }
    return {
      kind: 'network_fetch',
      coverArtId,
      data: fetched.data,
      mimeType: fetched.mimeType,
    };
  } catch (error) {
    failures.push({
      attemptedId: coverArtId,
      reason: 'network_error',
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function tryLocalFile(
  coverArtId: string,
  sources: CoverArtSources,
): Promise<CoverArtResolved | null> {
  if (!sources.readLocalFile) return null;
  const local = await sources.readLocalFile(coverArtId);
  if (!local?.localFilePath) return null;
  return {
    kind: 'local_file',
    coverArtId,
    localFilePath: local.localFilePath,
    mimeType: local.mimeType,
  };
}

function tryNetworkUrl(
  coverArtId: string,
  sources: CoverArtSources,
): CoverArtResolved | null {
  const url = sources.buildNetworkUrl?.(coverArtId) ?? null;
  if (!url) return null;
  return { kind: 'network_url', coverArtId, url };
}

/** Resolve cover art from ordered ids using the canonical source priority. */
export async function resolveCoverArt(
  idsToTry: string[],
  sources: CoverArtSources,
  options: ResolveCoverArtOptions = {},
): Promise<CoverArtResolved> {
  const validateNetworkBytes = options.validateNetworkBytes ?? true;
  const ids = uniqueIds(idsToTry);
  const failures: CoverArtLoadFailure[] = [];

  if (ids.length === 0) {
    const result: CoverArtResolved = { kind: 'placeholder' };
    logCoverArtUnavailable({
      reason: 'missing_cover_art_id',
      ...options.logContext,
    });
    return result;
  }

  for (const coverArtId of ids) {
    const disk = await tryDisk(coverArtId, sources);
    if (disk) return disk;

    const networkFetch = await tryNetworkFetch(
      coverArtId,
      sources,
      validateNetworkBytes,
      failures,
    );
    if (networkFetch) return networkFetch;

    const localFile = await tryLocalFile(coverArtId, sources);
    if (localFile) return localFile;

    const networkUrl = tryNetworkUrl(coverArtId, sources);
    if (networkUrl) return networkUrl;

    if (!sources.fetchNetwork && !sources.readLocalFile && !sources.buildNetworkUrl) {
      failures.push({ attemptedId: coverArtId, reason: 'no_api_or_cache' });
    }
  }

  const unavailable: CoverArtResolved = { kind: 'unavailable', failures };
  logCoverArtUnavailable({
    reason: 'all_sources_exhausted',
    coverArtId: ids[0],
    fallbackCoverArtId: ids[1],
    detail:
      options.logContext?.detail ??
      failures
        .map((f) => `${f.attemptedId}:${f.reason}${f.detail ? `(${f.detail})` : ''}`)
        .join(', '),
    ...options.logContext,
  });
  return unavailable;
}

/** Network-only refresh: tries fetch + persist for each id (cover art re-download). */
export async function refetchCoverArtFromNetwork(
  idsToTry: string[],
  sources: Pick<CoverArtSources, 'fetchNetwork' | 'persistNetwork'>,
): Promise<CoverArtResolved> {
  const ids = uniqueIds(idsToTry);
  if (!sources.fetchNetwork || ids.length === 0) {
    return { kind: 'unavailable', failures: [{ reason: 'no_api_or_cache' }] };
  }

  const failures: CoverArtLoadFailure[] = [];
  for (const coverArtId of ids) {
    const fetched = await tryNetworkFetch(coverArtId, sources as CoverArtSources, true, failures);
    if (fetched) return fetched;
  }
  return { kind: 'unavailable', failures };
}
