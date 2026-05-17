/**
 * v1 iOS shell — React bundle is a thin Capacitor client; native playback + Keychain live in PlatformHost.
 */
export const V1_IOS_ACCEPTANCE = [
  'Login and session restore (Keychain on iOS shell; localStorage in browser dev).',
  'Background audio with native transport; lock screen / Control Center play–pause.',
] as const;

export const V1_DEFERRED = [
  'Library, queue, and search UI (rebuild on top of Subsonic API + PlatformHost).',
  'CarPlay (legacy SwiftUI implementation archived under legacy-swiftui-ios/).',
  'Sleep timer parity.',
  'Aggressive offline downloads / cache tuning.',
  'Android / desktop shells (same PlatformHost contract).',
] as const;
