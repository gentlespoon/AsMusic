const ERROR_DOCUMENT_START =
  /^(<\?xml\b|<subsonic-response\b|<html\b|<!doctype\b|\{)/i;

/** Unit separator. Keeps code and message in one string without colliding with the text. */
const TOKEN_SEP = '\u001f';

export type ServerAudioError = {
  code: number | null;
  message: string;
};

/**
 * Subsonic often answers HTTP 200 with a short XML error instead of audio.
 * Returns the server code and message when `bytes` is that kind of document.
 */
export function parseServerAudioError(bytes: Uint8Array): ServerAudioError | null {
  const sample = bytes.subarray(0, 512);
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(sample)
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (!ERROR_DOCUMENT_START.test(text)) return null;
  const quoted = /message="([^"]*)"/.exec(text);
  const message = quoted?.[1]?.trim() || 'Server returned an error instead of audio';
  const codeText = /code="(\d+)"/.exec(text)?.[1];
  const code = codeText == null ? null : Number(codeText);
  return { code: Number.isFinite(code) ? code : null, message };
}

/** Server message when `bytes` is an error document instead of audio, otherwise null. */
export function serverAudioErrorMessage(bytes: Uint8Array): string | null {
  return parseServerAudioError(bytes)?.message ?? null;
}

export function serverAudioErrorToken(error: ServerAudioError): string {
  return `subsonic-error${TOKEN_SEP}${error.code ?? ''}${TOKEN_SEP}${error.message}`;
}

export function readServerAudioErrorToken(value: string): ServerAudioError | null {
  const parts = value.split(TOKEN_SEP);
  if (parts.length !== 3 || parts[0] !== 'subsonic-error') return null;
  const code = parts[1] === '' ? null : Number(parts[1]);
  return {
    code: code != null && Number.isFinite(code) ? code : null,
    message: parts[2] ?? '',
  };
}
