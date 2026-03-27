/**
 * Search: search2/search3, show artists / albums / songs, play or open.
 */

import { useState } from 'react';
import { useAuth, useSettings } from '@/contexts';
import { usePlayer } from '@/contexts';
import {
  formatDuration,
  languageDisplayName,
  sortArtistsByRomanized,
  sortByLocale,
} from '@/utils';
import type { Child } from 'subsonic-api';

type SearchArtist = { id: string; name: string };
type SearchAlbum = { id: string; name: string; artist?: string; artistId?: string; year?: number };

type SearchResults = {
  artist?: SearchArtist[];
  album?: SearchAlbum[] | Child[];
  song?: Child[];
};

export function SearchPage() {
  const { api } = useAuth();
  const { setQueue, playTrack } = usePlayer();
  const { sortLanguage } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [artistRomanizedKeys, setArtistRomanizedKeys] = useState<Map<string, string>>(new Map());
  const [artistLangCodes, setArtistLangCodes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = (q: string) => {
    if (!api || !q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    api
      .search3({ query: q.trim(), artistCount: 8, albumCount: 12, songCount: 20 })
      .then(async (res) => {
        const sr = (res as { searchResult3?: SearchResults }).searchResult3 ?? {};
        const { sorted: artist, keyMap, langMap } = await sortArtistsByRomanized(
          sr.artist ?? [],
          (a) => a.name,
          { getId: (a) => a.id, sortLanguage }
        );
        setArtistRomanizedKeys(keyMap);
        setArtistLangCodes(langMap);
        setResults({
          artist,
          album: sortByLocale((sr.album ?? []) as SearchAlbum[], (a) => a.name),
          song: sortByLocale(sr.song ?? [], (s) => s.title ?? ''),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setLoading(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const openArtist = (id: string) => {
    if (!api) return;
    api.getArtist({ id }).then((res) => {
      const artist = (res as { artist?: { album?: { id: string }[] } }).artist;
      const firstId = artist?.album?.[0]?.id;
      if (firstId) openAlbum(firstId);
    });
  };

  const openAlbum = (id: string) => {
    if (!api) return;
    api.getAlbum({ id }).then((res) => {
      const a = (res as { album?: { id: string; name: string; song?: Child[] } }).album;
      if (a?.song?.length) {
        setQueue(a.song, 0);
      }
    });
  };

  const playSong = (song: Child) => {
    playTrack(song);
  };

  const songs = results?.song ?? [];
  const artists = results?.artist ?? [];
  const albums = (results?.album ?? []) as SearchAlbum[];

  return (
    <div className="library search">
      <header className="library__header">
        <h1 className="library__title">Search</h1>
      </header>

      <form className="search__form" onSubmit={handleSubmit}>
        <input
          type="search"
          className="search__input"
          placeholder="Artists, albums, or tracks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="search__submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="library__error">{error}</p>}

      {results && !loading && (
        <div className="search__results">
          {artists.length > 0 && (
            <section className="search__section">
              <h2 className="search__section-title">Artists</h2>
              <ul className="library__list">
                {artists.map((a) => {
                  const romanized = artistRomanizedKeys.get(a.id);
                  const langCode = artistLangCodes.get(a.id);
                  const langName = langCode != null ? languageDisplayName(langCode) : null;
                  const showSubtitle = sortLanguage !== 'none' && ((romanized != null && romanized !== '') || langName != null);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="library__item"
                        onClick={() => openArtist(a.id)}
                      >
                        {a.name}
                        {showSubtitle ? (
                          <span className="library__item-romanized">
                            {' '}
                            ({[romanized && romanized !== '' && romanized, langName].filter(Boolean).join(' · ')})
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {albums.length > 0 && (
            <section className="search__section">
              <h2 className="search__section-title">Albums</h2>
              <ul className="library__grid">
                {albums.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="library__card"
                      onClick={() => openAlbum(a.id)}
                    >
                      <span className="library__card-title">{a.name}</span>
                      {a.artist != null && (
                        <span className="library__card-meta">{a.artist}</span>
                      )}
                      {a.year != null && (
                        <span className="library__card-meta">{a.year}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {songs.length > 0 && (
            <section className="search__section">
              <h2 className="search__section-title">Tracks</h2>
              <table className="library__table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Duration</th>
                    <th aria-label="Play" />
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr key={song.id} className="library__row">
                      <td className="library__track-title">{song.title}</td>
                      <td>{song.artist ?? '—'}</td>
                      <td className="library__duration">{formatDuration(song.duration ?? 0)}</td>
                      <td>
                        <button
                          type="button"
                          className="library__play-btn"
                          onClick={() => playSong(song)}
                          aria-label={`Play ${song.title}`}
                        >
                          ▶
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {artists.length === 0 && albums.length === 0 && songs.length === 0 && (
            <p className="search__empty">No results.</p>
          )}
        </div>
      )}
    </div>
  );
}
