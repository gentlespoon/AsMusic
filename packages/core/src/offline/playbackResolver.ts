import { offlineLookupScopes } from '../library/cacheScope';
import type { OfflineMediaStore } from './OfflineMediaStore';

export type ResolvePlaybackSourceArgs = {
  offlineMedia: OfflineMediaStore;
  serverUrl: string;
  username: string;
  libraryId: string;
  trackId: string;
  /** Offline blob variant matching the stream format preference (e.g. `mp3` or `''`). */
  variant: string;
  /** Used only when no ready offline copy exists */
  streamUrl: string;
};

export type ResolvedPlaybackSource = {
  url: string;
  revoke: () => void;
  localFilePath?: string;
  usedOffline: boolean;
};

/**
 * Local-first: use offline blob/file URL when `ready`, otherwise the provided stream URL.
 * Caller owns `revoke()` on the returned source when switching tracks or unloading.
 */
export async function resolvePlaybackSource(
  args: ResolvePlaybackSourceArgs
): Promise<ResolvedPlaybackSource> {
  const scopes = offlineLookupScopes(args.serverUrl, args.username, args.libraryId);
  for (const scope of scopes) {
    const local = await args.offlineMedia.getReadyPlaybackSource({
      scope,
      trackId: args.trackId,
      variant: args.variant,
    });
    if (local) {
      return {
        url: local.url,
        revoke: local.revoke,
        localFilePath: local.localFilePath,
        usedOffline: true,
      };
    }
  }
  return { url: args.streamUrl, revoke: () => {}, usedOffline: false };
}
