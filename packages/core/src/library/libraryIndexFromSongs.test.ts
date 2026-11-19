import { describe, expect, it } from 'vitest';
import type { Child } from 'subsonic-api';
import { derivedAlbumIdForCachedSong, songsInCachedAlbum } from './libraryIndexFromSongs';

function song(partial: Partial<Child> & Pick<Child, 'id'>): Child {
  return partial as Child;
}

describe('songsInCachedAlbum', () => {
  it('returns only the matching album, ordered by track number', () => {
    const songs = [
      song({ id: 'b', albumId: 'al-1', track: 2, title: 'Second' }),
      song({ id: 'other', albumId: 'al-2', track: 1, title: 'Elsewhere' }),
      song({ id: 'a', albumId: 'al-1', track: 1, title: 'First' }),
    ];
    expect(songsInCachedAlbum('al-1', songs).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('groups tracks that have no album id by title and artist', () => {
    const live = song({ id: '2', album: 'Live', artist: 'Ada', track: 2 });
    const songs = [
      live,
      song({ id: 'x', album: 'Other', artist: 'Ada', track: 1 }),
      song({ id: '1', album: 'Live', artist: 'Ada', track: 1 }),
    ];
    expect(songsInCachedAlbum(derivedAlbumIdForCachedSong(live), songs).map((s) => s.id)).toEqual([
      '1',
      '2',
    ]);
  });
});
