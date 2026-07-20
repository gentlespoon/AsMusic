import {
  isPlayableAudioSuffix,
  libraryCacheScope,
  OFFLINE_MEDIA_DEFAULT_VARIANT,
  type AudioPlaybackPlatform,
  type LibraryCacheScope,
  type OfflineMediaKey,
  type PlatformHost,
} from '@asmusic/core';
import { Capacitor } from '@capacitor/core';

export function resolveAudioPlaybackPlatform(): AudioPlaybackPlatform {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'web';
}

function scopesEqual(a: LibraryCacheScope, b: LibraryCacheScope): boolean {
  return a.serverKey === b.serverKey && a.libraryId === b.libraryId;
}

/**
 * Deletes ready offline blobs stored as raw/original (`variant` empty) when the
 * catalog suffix is not playable on the current platform.
 */
export async function purgeUnplayableRawOfflineMedia(
  host: PlatformHost,
  platform: AudioPlaybackPlatform = resolveAudioPlaybackPlatform(),
): Promise<void> {
  if (host.offlineMedia.backend === 'noop') return;

  const keys = await host.offlineMedia.listReadyKeys(null);
  const rawKeys = keys.filter(
    (k) => (k.variant ?? OFFLINE_MEDIA_DEFAULT_VARIANT) === OFFLINE_MEDIA_DEFAULT_VARIANT,
  );
  if (rawKeys.length === 0) return;

  const uniqueScopes: LibraryCacheScope[] = [];
  for (const key of rawKeys) {
    if (!uniqueScopes.some((s) => scopesEqual(s, key.scope))) {
      uniqueScopes.push(key.scope);
    }
  }

  const suffixByScopeTrack = new Map<string, string | undefined>();
  for (const scope of uniqueScopes) {
    try {
      const songs = await host.libraryCache.readSongList(scope);
      for (const song of songs) {
        const id = String(song.id);
        suffixByScopeTrack.set(
          `${scope.serverKey}\t${scope.libraryId}\t${id}`,
          song.suffix ?? undefined,
        );
      }
    } catch {
      /* skip scope if catalog unavailable */
    }
  }

  const toDelete: OfflineMediaKey[] = [];
  for (const key of rawKeys) {
    const mapKey = `${key.scope.serverKey}\t${key.scope.libraryId}\t${key.trackId}`;
    if (!suffixByScopeTrack.has(mapKey)) continue;
    const suffix = suffixByScopeTrack.get(mapKey);
    if (isPlayableAudioSuffix(suffix, platform)) continue;
    toDelete.push({
      scope: key.scope,
      trackId: key.trackId,
      variant: OFFLINE_MEDIA_DEFAULT_VARIANT,
    });
  }

  for (const key of toDelete) {
    try {
      await host.offlineMedia.delete(key);
    } catch {
      /* ignore per-track delete errors */
    }
  }
}

export async function deleteRawOfflineForTrack(
  host: PlatformHost,
  args: { serverUrl: string; username: string; libraryId: string; trackId: string },
): Promise<void> {
  if (host.offlineMedia.backend === 'noop') return;
  const scope = libraryCacheScope(args.serverUrl, args.username, args.libraryId);
  try {
    await host.offlineMedia.delete({
      scope,
      trackId: args.trackId,
      variant: OFFLINE_MEDIA_DEFAULT_VARIANT,
    });
  } catch {
    /* ignore */
  }
}
