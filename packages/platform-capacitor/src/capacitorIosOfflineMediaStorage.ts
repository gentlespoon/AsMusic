import {
  emitWaveformPeaksReady,
  offlineMediaKeyId,
  OFFLINE_MEDIA_DEFAULT_VARIANT,
  type LibraryCacheScope,
  type OfflineMediaKey,
  type OfflineMediaStatusDetail,
  type OfflineMediaStore,
  type OfflinePlaybackSource,
} from '@asmusic/core';
import { AsmusicNative } from './asmusicNativePlugin';

function keyToNativeParams(key: OfflineMediaKey) {
  return {
    serverKey: key.scope.serverKey,
    libraryId: key.scope.libraryId,
    trackId: key.trackId,
    variant: key.variant ?? OFFLINE_MEDIA_DEFAULT_VARIANT,
  };
}

function mapNativeStatus(raw: { status: string; byteLength?: number; mimeType?: string; updatedAt?: number }): OfflineMediaStatusDetail {
  const s = raw.status;
  if (s === 'ready') {
    return {
      status: 'ready',
      byteLength: raw.byteLength,
      mimeType: raw.mimeType,
      updatedAt: raw.updatedAt,
    };
  }
  if (s === 'invalid') {
    return { status: 'invalid' };
  }
  return { status: 'none' };
}

export function createCapacitorIosOfflineMediaStorage(): OfflineMediaStore {
  return {
    backend: 'ios-native',

    async getStatus(key: OfflineMediaKey): Promise<OfflineMediaStatusDetail> {
      const raw = await AsmusicNative.offlineMediaGetStatus(keyToNativeParams(key));
      return mapNativeStatus(raw);
    },

    async listReadyKeys(scopeFilter: LibraryCacheScope | null): Promise<OfflineMediaKey[]> {
      const { rowsJson } = await AsmusicNative.offlineMediaListReady(
        scopeFilter
          ? { serverKey: scopeFilter.serverKey, libraryId: scopeFilter.libraryId }
          : {}
      );
      const rows = JSON.parse(rowsJson) as Array<{
        serverKey: string;
        libraryId: string;
        trackId: string;
        variant: string;
      }>;
      return rows.map((r) => ({
        scope: { serverKey: r.serverKey, libraryId: r.libraryId },
        trackId: r.trackId,
        variant: r.variant.length > 0 ? r.variant : undefined,
      }));
    },

    async getReadyPlaybackSource(key: OfflineMediaKey): Promise<OfflinePlaybackSource | null> {
      const { url, localFilePath } = await AsmusicNative.offlineMediaGetPlaybackUrl(keyToNativeParams(key));
      if (!localFilePath && !url) return null;
      return {
        url: url ?? '',
        localFilePath: localFilePath ?? undefined,
        revoke: () => {},
      };
    },

    async getWaveformPeaks(key: OfflineMediaKey, barCount: number): Promise<number[] | null> {
      try {
        const { peaks } = await AsmusicNative.offlineMediaWaveformPeaks({
          ...keyToNativeParams(key),
          barCount,
        });
        if (peaks.length > 0) {
          emitWaveformPeaksReady(offlineMediaKeyId(key));
          return peaks;
        }
        return null;
      } catch {
        return null;
      }
    },

    async importFromAuthenticatedUrl(
      key: OfflineMediaKey,
      url: string,
      options?: { signal?: AbortSignal }
    ): Promise<void> {
      const p = AsmusicNative.offlineMediaImportFromUrl({ ...keyToNativeParams(key), url });
      if (options?.signal) {
        if (options.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const onAbort = () => {
          void AsmusicNative.offlineMediaDeleteOne(keyToNativeParams(key)).catch(() => {});
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
      await p;
    },

    async delete(key: OfflineMediaKey): Promise<void> {
      await AsmusicNative.offlineMediaDeleteOne(keyToNativeParams(key));
    },

    async deleteScope(scope: LibraryCacheScope): Promise<void> {
      await AsmusicNative.offlineMediaDeleteScope({ serverKey: scope.serverKey, libraryId: scope.libraryId });
    },

    async deleteServerAccount(serverKey: string): Promise<void> {
      await AsmusicNative.offlineMediaPurgeServerKey({ serverKey });
    },

    async purgeAll(): Promise<void> {
      const keys = await this.listReadyKeys(null);
      const seen = new Set<string>();
      const scopes: LibraryCacheScope[] = [];
      for (const key of keys) {
        const id = `${key.scope.serverKey}\t${key.scope.libraryId}`;
        if (seen.has(id)) continue;
        seen.add(id);
        scopes.push(key.scope);
      }
      await Promise.all(scopes.map((scope) => this.deleteScope(scope)));
    },

    async totalReadyBytes(scopeFilter: LibraryCacheScope | null): Promise<number> {
      const { totalBytes } = await AsmusicNative.offlineMediaTotalBytes(
        scopeFilter ? { serverKey: scopeFilter.serverKey, libraryId: scopeFilter.libraryId } : {}
      );
      return Number(totalBytes);
    },
  };
}
