/**
 * All Songs: random songs list (getRandomSongs), play.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts';
import { usePlayer } from '@/contexts';
import { formatDuration, sortByLocale } from '@/utils';
import type { Child } from 'subsonic-api';

export function AllSongsPage() {
  const { api } = useAuth();
  const { setQueue } = usePlayer();
  const [songs, setSongs] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    setError(null);
    api
      .getRandomSongs({ size: 50 })
      .then((res) => {
        const list = (res as { randomSongs?: { song?: Child[] } }).randomSongs?.song ?? [];
        setSongs(sortByLocale(Array.isArray(list) ? list : [], (s) => s.title ?? ''));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load songs'))
      .finally(() => setLoading(false));
  }, [api]);

  const playFrom = (startIndex: number) => setQueue(songs, startIndex);

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
        <h1 className="library__title">All Songs</h1>
      </header>
      {loading && songs.length === 0 ? (
        <p>Loading…</p>
      ) : (
        <table className="library__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Album</th>
              <th>Duration</th>
              <th aria-label="Play" />
            </tr>
          </thead>
          <tbody>
            {songs.map((song, i) => (
              <tr key={song.id} className="library__row">
                <td className="library__track-title">{song.title}</td>
                <td>{song.artist ?? '—'}</td>
                <td>{song.album ?? '—'}</td>
                <td className="library__duration">{formatDuration(song.duration ?? 0)}</td>
                <td>
                  <button
                    type="button"
                    className="library__play-btn"
                    onClick={() => playFrom(i)}
                    aria-label={`Play ${song.title}`}
                  >
                    ▶
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
