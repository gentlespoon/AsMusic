import { STREAM_FORMAT } from '@asmusic/core';

/**
 * Catalog/original suffix, plus stream container when server transcode is on
 * (e.g. `WMA (MP3)`). Already-MP3 sources stay `MP3`.
 */
export function formatPlaybackFormatLabel(
  suffix: string | undefined,
  serverTranscodeEnabled: boolean,
): string | null {
  const original = suffix?.trim().toUpperCase() || null;
  const stream = STREAM_FORMAT.toUpperCase();
  if (!serverTranscodeEnabled) return original;
  if (!original || original === stream) return stream;
  return `${original} (${stream})`;
}
