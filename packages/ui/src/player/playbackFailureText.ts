import { readServerAudioErrorToken } from '@asmusic/core';
import type { MessageKey } from '@asmusic/i18n';

type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

/**
 * Turns a transport failure into a sentence the listener can act on.
 * Subsonic error documents arrive as a token from native playback; other
 * messages (codec failures, network drops) stay as the player reported them.
 */
export function playbackFailureText(message: string, t: Translate): string {
  const parsed = readServerAudioErrorToken(message);
  if (!parsed) return message;
  const missing =
    parsed.code === 70 || parsed.message.trim().toLowerCase() === 'data not found';
  if (missing) {
    return t('player.playback.missingOnServer', { detail: parsed.message });
  }
  return t('player.playback.serverError', { detail: parsed.message });
}
