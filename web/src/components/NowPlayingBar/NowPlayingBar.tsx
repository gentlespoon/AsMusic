import { usePlayer } from '@/contexts';
import { formatDuration } from '@/utils';

export function NowPlayingBar() {
  const {
    currentTrack,
    isPlaying,
    position,
    togglePlayPause,
    seek,
    next,
    previous,
  } = usePlayer();

  const duration = currentTrack?.duration ?? 0;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  if (!currentTrack) {
    return (
      <div className="now-playing">
        <div className="now-playing__empty">No track selected</div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing__track">
        <span className="now-playing__title">{currentTrack.title}</span>
        <span className="now-playing__artist">
          {currentTrack.artist ?? currentTrack.album ?? '—'}
        </span>
      </div>
      <div className="now-playing__controls">
        <button
          type="button"
          className="now-playing__btn"
          onClick={previous}
          aria-label="Previous"
        >
          ‹‹
        </button>
        <button
          type="button"
          className="now-playing__btn now-playing__btn--play"
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '‖' : '▶'}
        </button>
        <button
          type="button"
          className="now-playing__btn"
          onClick={next}
          aria-label="Next"
        >
          ››
        </button>
      </div>
      <div className="now-playing__progress-wrap">
        <span className="now-playing__time">{formatDuration(position)}</span>
        <input
          type="range"
          className="now-playing__progress"
          min={0}
          max={duration || 100}
          value={position}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="now-playing__time">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
