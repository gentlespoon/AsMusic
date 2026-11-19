import { describe, expect, it } from 'vitest';
import { offlineMediaKeyFromId, offlineMediaKeyId, type OfflineMediaKey } from './OfflineMediaStore';

describe('offlineMediaKeyFromId', () => {
  it('round-trips a transcoded key', () => {
    const key: OfflineMediaKey = {
      scope: { serverKey: 'abc', libraryId: '1' },
      trackId: 'track',
      variant: 'mp3',
    };
    expect(offlineMediaKeyFromId(offlineMediaKeyId(key))).toEqual(key);
  });

  it('round-trips a raw key as an omitted variant', () => {
    const key: OfflineMediaKey = {
      scope: { serverKey: 'abc', libraryId: '1' },
      trackId: 'track',
    };
    expect(offlineMediaKeyFromId(offlineMediaKeyId(key))).toEqual(key);
  });

  it('rejects a malformed id', () => {
    expect(offlineMediaKeyFromId('only-one-field')).toBeNull();
  });
});
