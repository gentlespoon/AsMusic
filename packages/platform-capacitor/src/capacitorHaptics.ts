import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { HapticImpactStyle, HapticsHost } from '@asmusic/core';

function toImpactStyle(style: HapticImpactStyle | undefined): ImpactStyle {
  switch (style) {
    case 'medium':
      return ImpactStyle.Medium;
    case 'heavy':
      return ImpactStyle.Heavy;
    case 'light':
    default:
      return ImpactStyle.Light;
  }
}

export const capacitorHaptics: HapticsHost = {
  async impact(style) {
    try {
      await Haptics.impact({ style: toImpactStyle(style) });
    } catch {
      /* ignore — simulator or unsupported device */
    }
  },
};
