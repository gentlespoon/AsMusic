import { PlayerMiniBar } from './miniBar/PlayerMiniBar';
import { PlayerFullScreen } from './fullScreen/PlayerFullScreen';
import { PlayerPlaybackToast } from './PlayerPlaybackToast';
import { PlayerServerTranscodePrompt } from './PlayerServerTranscodePrompt';

export function PlayerChrome() {
  return (
    <>
      <PlayerMiniBar />
      <PlayerFullScreen />
      <PlayerPlaybackToast />
      <PlayerServerTranscodePrompt />
    </>
  );
}
