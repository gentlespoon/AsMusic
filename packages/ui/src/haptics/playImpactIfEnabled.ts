import type { PlatformHost } from '@asmusic/core';
import { getHapticFeedbackEnabled } from '@ui/preferences/hapticFeedbackPreference';

/** Soft impact when haptics are enabled (legacy `AppHaptics.playImpactIfEnabled`). */
export function playImpactIfEnabled(host: PlatformHost): void {
  if (!getHapticFeedbackEnabled()) return;
  void host.haptics.impact('light');
}
