/** Where playback actually runs; drives format allowlists. */
export type AudioPlaybackPlatform = 'ios' | 'web';

const IOS_PLAYABLE_SUFFIXES = new Set([
  'mp3',
  'm4a',
  'aac',
  'mp4',
  'wav',
  'flac',
  'alac',
]);

const WEB_PLAYABLE_SUFFIXES = new Set([
  ...IOS_PLAYABLE_SUFFIXES,
  'ogg',
  'opus',
]);

const IOS_UNPLAYABLE_MIME_PREFIXES = [
  'audio/x-ms-wma',
  'audio/wma',
  'video/x-ms-asf',
  'audio/ape',
  'audio/x-ape',
  'audio/ogg',
  'application/ogg',
  'audio/opus',
];

const WEB_UNPLAYABLE_MIME_PREFIXES = [
  'audio/x-ms-wma',
  'audio/wma',
  'video/x-ms-asf',
  'audio/ape',
  'audio/x-ape',
];

function suffixSetFor(platform: AudioPlaybackPlatform): Set<string> {
  return platform === 'ios' ? IOS_PLAYABLE_SUFFIXES : WEB_PLAYABLE_SUFFIXES;
}

/**
 * Whether the catalog/file suffix is expected to play without server transcoding.
 * Unknown/empty suffix returns true so we do not treat network errors as format failures.
 */
export function isPlayableAudioSuffix(
  suffix: string | undefined,
  platform: AudioPlaybackPlatform,
): boolean {
  const s = suffix?.trim().toLowerCase();
  if (!s) return true;
  return suffixSetFor(platform).has(s);
}

/**
 * MIME-based check when suffix is unavailable. Unknown/empty MIME returns true.
 */
export function isPlayableAudioMime(
  mime: string | undefined,
  platform: AudioPlaybackPlatform,
): boolean {
  const m = mime?.trim().toLowerCase().split(';')[0]?.trim();
  if (!m || m === 'application/octet-stream') return true;
  const blocked =
    platform === 'ios' ? IOS_UNPLAYABLE_MIME_PREFIXES : WEB_UNPLAYABLE_MIME_PREFIXES;
  if (blocked.some((p) => m === p || m.startsWith(`${p}`))) return false;
  if (m.startsWith('audio/')) return true;
  return true;
}
