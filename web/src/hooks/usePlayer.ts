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
    seek: (_position: number) => {},
    playTrack: (_id: string) => {},
    setQueue: (_ids: string[]) => {},
  };
}
