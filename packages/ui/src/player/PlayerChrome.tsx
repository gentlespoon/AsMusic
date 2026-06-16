import { PlayerMiniBar } from './miniBar/PlayerMiniBar';
import { PlayerFullScreen } from './fullScreen/PlayerFullScreen';
import { PlayerPlaybackToast } from './PlayerPlaybackToast';

export function PlayerChrome() {
  return (
    <>
      <PlayerMiniBar />
      <PlayerFullScreen />
      <PlayerPlaybackToast />
    </>
  );
}
