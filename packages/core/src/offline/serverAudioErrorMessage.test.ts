import { describe, expect, it } from 'vitest';
import {
  parseServerAudioError,
  readServerAudioErrorToken,
  serverAudioErrorMessage,
  serverAudioErrorToken,
} from './serverAudioErrorMessage';

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('serverAudioErrorMessage', () => {
  it('reads the message from a Subsonic error document', () => {
    const xml =
      '<subsonic-response status="failed" version="1.16.1"><error code="70" message="Song not found"></error></subsonic-response>';
    expect(serverAudioErrorMessage(bytes(xml))).toBe('Song not found');
    const parsed = parseServerAudioError(bytes(xml));
    expect(parsed).toEqual({ code: 70, message: 'Song not found' });
    expect(readServerAudioErrorToken(serverAudioErrorToken(parsed!))).toEqual(parsed);
  });

  it('ignores an MP3 header', () => {
    const header = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    expect(serverAudioErrorMessage(header)).toBeNull();
  });
});
