import { Capacitor } from '@capacitor/core';
import { browserHost } from '@asmusic/platform-web';
import { iosCapacitorHost } from '@asmusic/platform-capacitor';
import type { PlatformHost } from '@asmusic/core';

export function createPlatformHost(): PlatformHost {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    return iosCapacitorHost;
  }
  return browserHost;
}
