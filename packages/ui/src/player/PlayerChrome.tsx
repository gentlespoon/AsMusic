import { PlayerMiniBar } from './miniBar/PlayerMiniBar';
import { PlayerFullScreen } from './fullScreen/PlayerFullScreen';

export function PlayerChrome() {
  return (
    <>
      <PlayerMiniBar />
      <PlayerFullScreen />
    </>
  );
}
