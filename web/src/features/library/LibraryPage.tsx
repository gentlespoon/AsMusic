/**
 * Artist: browse by letter (getArtists) → artist albums (getArtist) → album tracks (getAlbum), play.
 * All lists are vertical. Artist list shows album count; artist detail shows album + song counts.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts';
import { usePlayer } from '@/contexts';
import { useSettings } from '@/contexts';
import {
  formatDuration,
  languageDisplayName,
  sortArtistsByRomanized,
  sortByLocale,
  sortByTrackNumber,
} from '@/utils';
import type { Child } from 'subsonic-api';

type IndexEntry = { name: string; artist?: { id: string; name: string; albumCount?: number }[] };
type ArtistEntry = {
  id: string;
  name: string;
  album?: { id: string; name: string; artist?: string; year?: number; songCount?: number }[];
};
type AlbumEntry = { id: string; name: string; song?: Child[] };

export function LibraryPage() {
  const { api } = useAuth();
  const { setQueue } = usePlayer();
  const { sortLanguage } = useSettings();
  const [view, setView] = useState<'index' | 'artist' | 'album'>('index');
  const [, setSelectedId] = useState<string | null>(null);
  const [indexes, setIndexes] = useState<IndexEntry[]>([]);
  const [sortedIndexes, setSortedIndexes] = useState<IndexEntry[] | null>(null);
  const [artistRomanizedKeys, setArtistRomanizedKeys] = useState<Map<string, string>>(new Map());
  const [artistLangCodes, setArtistLangCodes] = useState<Map<string, string>>(new Map());
  const [artist, setArtist] = useState<ArtistEntry | null>(null);
  const [album, setAlbum] = useState<AlbumEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getArtists()
      .then((res) => {
        const data = (res as { artists?: { index?: IndexEntry[] } }).artists;
        const list = data?.index ?? [];
        setIndexes(Array.isArray(list) ? list : []);
        setSortedIndexes(null);
        setView('index');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load artists'))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    if (indexes.length === 0) {
      setSortedIndexes([]);
      setArtistRomanizedKeys(new Map());
      setArtistLangCodes(new Map());
      return;
    }
    let cancelled = false;
    const allArtists = indexes.flatMap((idx) => idx.artist ?? []);
    sortArtistsByRomanized(allArtists, (a) => a.name, {
      getId: (a) => a.id,
      sortLanguage,
    }).then(
      (result) => {
        if (cancelled) return;
        setArtistRomanizedKeys(result.keyMap);
        setArtistLangCodes(result.langMap);
        const indexLetter = (key: string): string => {
          const raw = (key ?? '').trim().charAt(0);
          if (!raw) return '#';
          const normalized = raw.normalize('NFD').replace(/\p{M}/gu, '')[0] ?? raw;
          const upper = normalized.toUpperCase();
          if (/[A-Z]/.test(upper)) return upper;
          if (/\d/.test(raw)) return '#';
          return '#';
        };
        const groups = new Map<string, typeof allArtists>();
        for (const a of result.sorted) {
          const letter = indexLetter(result.keyMap.get(a.id) ?? a.name);
          const list = groups.get(letter) ?? [];
          list.push(a);
          groups.set(letter, list);
        }
        const sectionOrder = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
        const reindexed: IndexEntry[] = sectionOrder
          .map((name) => ({ name, artist: groups.get(name) ?? [] }))
          .filter((entry) => (entry.artist?.length ?? 0) > 0);
        setSortedIndexes(reindexed);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [indexes, sortLanguage]);

  const openArtist = (id: string) => {
    if (!api) return;
    setSelectedId(id);
    setLoading(true);
    setError(null);
    api
      .getArtist({ id })
      .then((res) => {
        const a = (res as { artist?: ArtistEntry }).artist;
        setArtist(a ?? null);
        setView('artist');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load artist'))
      .finally(() => setLoading(false));
  };

  const openAlbum = (id: string) => {
    if (!api) return;
    setSelectedId(id);
    setLoading(true);
    setError(null);
    api
      .getAlbum({ id })
      .then((res) => {
        const a = (res as { album?: AlbumEntry }).album;
        setAlbum(a ?? null);
        setView('album');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load album'))
      .finally(() => setLoading(false));
  };

  const backToIndex = () => {
    setView('index');
    setSelectedId(null);
    setArtist(null);
    setAlbum(null);
  };
  const backToArtist = () => {
    setView('artist');
    setAlbum(null);
    setSelectedId(artist?.id ?? null);
  };

  const playAlbumFrom = (tracks: Child[], startIndex: number) => {
    setQueue(tracks, startIndex);
  };

  const albumCount = artist?.album?.length ?? 0;
  const totalSongs = (artist?.album ?? []).reduce((sum, a) => sum + (a.songCount ?? 0), 0);

  if (error) {
    return (
      <div className="library">
        <p className="library__error">{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (loading && view === 'index' && indexes.length === 0) {
    return <div className="library">Loading artists…</div>;
  }

  return (
    <div className="library">
      <header className="library__header">
        {view !== 'index' && (
          <button type="button" className="library__back" onClick={view === 'album' ? backToArtist : backToIndex}>
            ← Back
          </button>
        )}
        <h1 className="library__title">
          {view === 'index' && 'Artists'}
          {view === 'artist' && (artist?.name ?? 'Artist')}
          {view === 'album' && (album?.name ?? 'Album')}
        </h1>
        {view === 'artist' && artist && (
          <p className="library__meta">
            {albumCount} album{albumCount !== 1 ? 's' : ''} · {totalSongs} song{totalSongs !== 1 ? 's' : ''}
          </p>
        )}
      </header>

      {view === 'index' && (
        <div className="library__index library__index--list">
          {(sortedIndexes ?? indexes).map((idx) => (
            <section key={idx.name} className="library__section">
              <h2 className="library__letter">{idx.name}</h2>
              <ul className="library__list library__list--vertical">
                {(idx.artist ?? []).map((a) => {
                  const romanized = artistRomanizedKeys.get(a.id);
                  const langCode = artistLangCodes.get(a.id);
                  const langName = langCode != null ? languageDisplayName(langCode) : null;
                  const showSubtitle = sortLanguage !== 'none' && ((romanized != null && romanized !== '') || langName != null);
                  return (
                  <li key={a.id}>
                    <button type="button" className="library__item library__item--block" onClick={() => openArtist(a.id)}>
                      <span className="library__item-title">
                        {a.name}
                        {showSubtitle ? (
                          <span className="library__item-romanized">
                            {' '}
                            ({[romanized && romanized !== '' && romanized, langName].filter(Boolean).join(' · ')})
                          </span>
                        ) : null}
                      </span>
                      <span className="library__item-meta">
                        {(a.albumCount ?? 0)} album{(a.albumCount ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {view === 'artist' && (
        <div className="library__albums">
          {loading && !artist ? (
            <p>Loading…</p>
          ) : (
            <ul className="library__list library__list--vertical library__list--stacked">
              {sortByLocale(artist?.album ?? [], (a) => a.name).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="library__item library__item--block"
                    onClick={() => openAlbum(a.id)}
                  >
                    <span className="library__item-title">{a.name}</span>
                    <span className="library__item-meta">
                      {a.songCount ?? 0} song{(a.songCount ?? 0) !== 1 ? 's' : ''}
                      {a.year != null ? ` · ${a.year}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === 'album' && (
        <div className="library__tracks">
          {loading && !album ? (
            <p>Loading…</p>
          ) : (
            <table className="library__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Duration</th>
                  <th aria-label="Play" />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = sortByTrackNumber(album?.song ?? []);
                  return sorted.map((song, i) => (
                  <tr key={song.id} className="library__row">
                    <td className="library__num">{i + 1}</td>
                    <td className="library__track-title">{song.title}</td>
                    <td className="library__duration">{formatDuration(song.duration ?? 0)}</td>
                    <td>
                      <button
                        type="button"
                        className="library__play-btn"
                        onClick={() => playAlbumFrom(sorted, i)}
                        aria-label={`Play ${song.title}`}
                      >
                        ▶
                      </button>
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
