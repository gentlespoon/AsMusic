/**
 * Album list (getAlbumList2) → album tracks (getAlbum), play.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts';
import { usePlayer } from '@/contexts';
import { formatDuration, sortByLocale, sortByTrackNumber } from '@/utils';
import type { Child } from 'subsonic-api';

type AlbumItem = { id: string; name: string; artist?: string; artistId?: string; year?: number };
type AlbumDetail = { id: string; name: string; song?: Child[] };

export function AlbumListPage() {
  const { api } = useAuth();
  const { setQueue } = usePlayer();
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [selected, setSelected] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getAlbumList2({ type: 'newest', size: 50 })
      .then((res) => {
        const list = (res as { albumList2?: { album?: AlbumItem[] } }).albumList2?.album ?? [];
        setAlbums(sortByLocale(Array.isArray(list) ? list : [], (a) => a.name));
        setSelected(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load albums'))
      .finally(() => setLoading(false));
  }, [api]);

  const openAlbum = (id: string) => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getAlbum({ id })
      .then((res) => {
        const a = (res as { album?: AlbumDetail }).album ?? null;
        setSelected(a);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load album'))
      .finally(() => setLoading(false));
  };

  const playFrom = (tracks: Child[], startIndex: number) => setQueue(tracks, startIndex);

  if (error) {
    return (
      <div className="library">
        <p className="library__error">{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="library">
      <header className="library__header">
        {selected && (
          <button type="button" className="library__back" onClick={() => setSelected(null)}>
            ← Back
          </button>
        )}
        <h1 className="library__title">{selected ? selected.name : 'Albums'}</h1>
      </header>

      {!selected ? (
        <ul className="library__list library__list--vertical library__list--stacked">
          {loading && albums.length === 0 ? (
            <li>Loading albums…</li>
          ) : (
            albums.map((a) => (
              <li key={a.id}>
                <button type="button" className="library__item library__item--block" onClick={() => openAlbum(a.id)}>
                  <span className="library__item-title">{a.name}</span>
                  <span className="library__item-meta">
                    {a.artist != null ? a.artist : ''}
                    {a.artist != null && a.year != null ? ' · ' : ''}
                    {a.year != null ? a.year : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
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
              const sorted = sortByTrackNumber(selected.song ?? []);
              return sorted.map((song, i) => (
                <tr key={song.id} className="library__row">
                  <td className="library__num">{i + 1}</td>
                  <td className="library__track-title">{song.title}</td>
                  <td className="library__duration">{formatDuration(song.duration ?? 0)}</td>
                  <td>
                    <button
                      type="button"
                      className="library__play-btn"
                      onClick={() => playFrom(sorted, i)}
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
  );
}
