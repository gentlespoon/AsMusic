/** Secure storage / prefs key: when true, background pipeline may persist streamed bytes (host-specific). */
export const PERSIST_WHILE_STREAMING_KEY = 'asmusic-persist-while-streaming-v1';

/** Default-on: stored `'0'` disables; missing or `'1'` enables. */
export function readPersistWhileStreamingEnabled(stored: string | null | undefined): boolean {
  return stored !== '0';
}
