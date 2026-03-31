/**
 * Playback state: current track, queue, play/pause, seek.
 */

export function usePlayer() {
  return {
    currentTrack: null,
    queue: [] as string[],
    isPlaying: false,
    position: 0,
    play: () => {},
    pause: () => {},
    seek: (position: number) => {
      void position;
    },
    playTrack: (id: string) => {
      void id;
    },
    setQueue: (ids: string[]) => {
      void ids;
    },
  };
}
