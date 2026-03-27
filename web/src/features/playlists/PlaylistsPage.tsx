/**
 * Playlists: list (getPlaylists) → detail (getPlaylist) with play.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts';
import { usePlayer } from '@/contexts';
import { formatDuration, sortByLocale } from '@/utils';
import type { Child } from 'subsonic-api';

type PlaylistItem = { id: string; name: string; songCount: number; duration: number; owner?: string };
type PlaylistDetail = PlaylistItem & { entry?: Child[] };

export function PlaylistsPage() {
  const { api } = useAuth();
  const { setQueue } = usePlayer();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [selected, setSelected] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getPlaylists()
      .then((res) => {
        const list = (res as { playlists?: { playlist?: PlaylistItem[] } }).playlists?.playlist ?? [];
        setPlaylists(sortByLocale(Array.isArray(list) ? list : [], (p) => p.name));
        setSelected(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load playlists'))
      .finally(() => setLoading(false));
  }, [api]);

  const openPlaylist = (id: string) => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getPlaylist({ id })
      .then((res) => {
        const p = (res as { playlist?: PlaylistDetail }).playlist ?? null;
        setSelected(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load playlist'))
      .finally(() => setLoading(false));
  };

  const playFrom = (tracks: Child[], startIndex: number) => {
    setQueue(tracks, startIndex);
  };

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

  return (
    <div className="library">
      <header className="library__header">
        {selected && (
          <button
            type="button"
            className="library__back"
            onClick={() => setSelected(null)}
          >
            ← Back
          </button>
        )}
        <h1 className="library__title">
          {selected ? selected.name : 'Playlists'}
        </h1>
      </header>

      {!selected ? (
        <ul className="library__list library__list--stacked">
          {loading && playlists.length === 0 ? (
            <li>Loading playlists…</li>
          ) : (
            playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="library__item library__item--block"
                  onClick={() => openPlaylist(p.id)}
                >
                  <span className="library__item-title">{p.name}</span>
                  <span className="library__item-meta">
                    {p.songCount} tracks · {formatDuration(p.duration)}
                    {p.owner ? ` · ${p.owner}` : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="library__tracks">
          {loading && !selected.entry ? (
            <p>Loading…</p>
          ) : (
            <table className="library__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Duration</th>
                  <th aria-label="Play" />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = sortByLocale(selected.entry ?? [], (s) => s.title ?? '');
                  return sorted.map((song, i) => (
                    <tr key={song.id} className="library__row">
                      <td className="library__num">{i + 1}</td>
                      <td className="library__track-title">{song.title}</td>
                      <td>{song.artist ?? '—'}</td>
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
      )}
    </div>
  );
}
