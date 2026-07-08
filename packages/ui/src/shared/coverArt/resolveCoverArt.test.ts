import { describe, expect, it } from 'vitest';
import { resolveCoverArt } from './resolveCoverArt.ts';
import { toNowPlayingArtwork } from './toNowPlayingArtwork.ts';
import type { CoverArtSources } from './types.ts';

const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

function sources(overrides: Partial<CoverArtSources> = {}): CoverArtSources {
  return {
    readDisk: async () => null,
    ...overrides,
  };
}

describe('resolveCoverArt', () => {
  it('returns disk hit on second id after first misses', async () => {
    const calls: string[] = [];
    const resolved = await resolveCoverArt(
      ['missing', 'album-1'],
      sources({
        readDisk: async (id) => {
          calls.push(id);
          if (id === 'album-1') {
            return { coverArtId: id, mimeType: 'image/jpeg', data: JPEG_BYTES };
          }
          return null;
        },
      }),
    );
    expect(resolved.kind).toBe('disk');
    if (resolved.kind === 'disk') {
      expect(resolved.coverArtId).toBe('album-1');
    }
    expect(calls).toEqual(['missing', 'album-1']);
  });

  it('persists only after valid network fetch', async () => {
    const persisted: string[] = [];
    const invalid = new Uint8Array(4);
    const resolvedInvalid = await resolveCoverArt(
      ['track-1'],
      sources({
        fetchNetwork: async () => ({ data: invalid, mimeType: 'image/jpeg' }),
        persistNetwork: async (id) => {
          persisted.push(id);
        },
      }),
    );
    expect(resolvedInvalid.kind).toBe('unavailable');
    expect(persisted).toHaveLength(0);

    const resolvedValid = await resolveCoverArt(
      ['track-1'],
      sources({
        fetchNetwork: async () => ({ data: JPEG_BYTES, mimeType: 'image/jpeg' }),
        persistNetwork: async (id) => {
          persisted.push(id);
        },
      }),
    );
    expect(resolvedValid.kind).toBe('network_fetch');
    expect(persisted).toEqual(['track-1']);
  });

  it('skips local file when disk succeeds', async () => {
    let localCalled = false;
    const resolved = await resolveCoverArt(
      ['track-1'],
      sources({
        readDisk: async () => ({
          coverArtId: 'track-1',
          mimeType: 'image/jpeg',
          data: JPEG_BYTES,
        }),
        readLocalFile: async () => {
          localCalled = true;
          return { localFilePath: '/tmp/x.jpg', mimeType: 'image/jpeg' };
        },
      }),
    );
    expect(resolved.kind).toBe('disk');
    expect(localCalled).toBe(false);
  });

  it('uses network URL when fetch is unavailable', async () => {
    const resolved = await resolveCoverArt(
      ['track-1'],
      sources({
        buildNetworkUrl: (id) => `https://example.test/art/${id}`,
      }),
    );
    expect(resolved.kind).toBe('network_url');
    if (resolved.kind === 'network_url') {
      expect(resolved.url).toBe('https://example.test/art/track-1');
    }
  });
});

describe('toNowPlayingArtwork', () => {
  it('returns base64 on ios-capacitor for disk', () => {
    const art = toNowPlayingArtwork(
      {
        kind: 'disk',
        coverArtId: 'a',
        data: JPEG_BYTES,
        mimeType: 'image/jpeg',
      },
      'ios-capacitor',
    );
    expect(art.artworkDataBase64).toBeTruthy();
    expect(art.artworkPlaceholderDataBase64).toBeTruthy();
  });

  it('returns URL for network_url', () => {
    const art = toNowPlayingArtwork(
      { kind: 'network_url', coverArtId: 'a', url: 'https://example.test/art' },
      'ios-capacitor',
    );
    expect(art.artworkUrl).toBe('https://example.test/art');
  });
});
