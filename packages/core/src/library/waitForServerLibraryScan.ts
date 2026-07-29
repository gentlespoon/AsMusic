import type { ScanStatus } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import { DEFAULT_LIBRARY_ID } from './constants';

export type ServerLibraryScanProgress = {
  scanning: boolean;
  count?: number;
};

export type WaitForServerLibraryScanOptions = {
  /**
   * Music folder / library id to scan (Subsonic `musicFolderId`).
   * On Navidrome this maps to `startScan` `target=<id>:` so only that library is scanned.
   * Omit or use {@link DEFAULT_LIBRARY_ID} for a whole-server scan (servers with no folders).
   */
  libraryId?: string;
  /** Poll interval in ms. Default 2000. */
  pollIntervalMs?: number;
  /** Give up after this many ms. Default 1 hour. */
  timeoutMs?: number;
  onProgress?: (status: ServerLibraryScanProgress) => void;
  signal?: AbortSignal;
};

type StartScanResponse = {
  status?: string;
  scanStatus?: ScanStatus;
  error?: { message?: string };
};

function isOk(r: { status?: string } | null | undefined): boolean {
  return r?.status === 'ok';
}

function responseErrorMessage(r: unknown, fallback: string): string {
  if (r && typeof r === 'object' && 'error' in r) {
    const message = (r as { error?: { message?: string } }).error?.message;
    if (message) return message;
  }
  return fallback;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Starts a Subsonic/Navidrome media library scan and waits until it finishes.
 * Typically requires admin privileges on the server.
 *
 * When {@link WaitForServerLibraryScanOptions.libraryId} is a concrete music folder id,
 * Navidrome selective scan is requested via `target=<libraryId>:` so other libraries
 * on the same server are not scanned.
 */
export async function waitForServerLibraryScan(
  api: SubsonicAPI,
  options?: WaitForServerLibraryScanOptions
): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 60 * 60 * 1000;
  const startedAt = Date.now();

  const start = await startLibraryScan(api, options?.libraryId);
  if (!isOk(start)) {
    throw new Error(responseErrorMessage(start, 'startScan failed'));
  }

  let status = start.scanStatus ?? { scanning: false };
  options?.onProgress?.(status);

  while (status.scanning) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Server library scan timed out');
    }
    await sleep(pollIntervalMs, options?.signal);
    const r = await api.getScanStatus();
    if (!isOk(r)) {
      throw new Error(responseErrorMessage(r, 'getScanStatus failed'));
    }
    status = r.scanStatus ?? { scanning: false };
    options?.onProgress?.(status);
  }
}

async function startLibraryScan(
  api: SubsonicAPI,
  libraryId: string | undefined
): Promise<StartScanResponse> {
  if (libraryId && libraryId !== DEFAULT_LIBRARY_ID) {
    // Navidrome: `target=libraryID:folderPath` with empty path = whole library/folder.
    return api.customJSON<StartScanResponse>('startScan.view', {
      target: `${libraryId}:`,
    });
  }
  return api.startScan();
}
