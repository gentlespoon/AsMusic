import {
  usePlayerShell,
  usePlayerTransportState,
} from "../../contexts/PlayerContext";
import { useMiniPlayerSwipeGesturesEnabled } from "./miniPlayerPreferences";
import { PlayerMiniBarContentRow } from "./PlayerMiniBarContentRow";
import { PlayerMiniBarFullPlayerButton } from "./PlayerMiniBarFullPlayerButton";
import { PlayerMiniBarGestureZone } from "./PlayerMiniBarGestureZone";
import { PlayerMiniBarProgressLayer } from "./PlayerMiniBarProgressLayer";
import { PlayerMiniBarQueueButton } from "./PlayerMiniBarQueueButton";
import { PlayerMiniBarShell } from "./PlayerMiniBarShell";
import { PlayerMiniBarTransportButtons } from "./PlayerMiniBarTransportButtons";
import { usePlayerMiniBarBeltGestures } from "./usePlayerMiniBarBeltGestures";
import { usePlayerMiniBarCoverApi } from "./usePlayerMiniBarCoverApi";
import { usePlayerMiniBarProgress } from "./usePlayerMiniBarProgress";

export function PlayerMiniBarExpanded() {
  const state = usePlayerTransportState();
  const { fullPlayerOpen } = usePlayerShell();
  const item = state.currentItem;
  const swipeGestures = useMiniPlayerSwipeGesturesEnabled();
  const api = usePlayerMiniBarCoverApi(item);
  const progress = usePlayerMiniBarProgress(state, item);
  const belt = usePlayerMiniBarBeltGestures(swipeGestures);

  return (
    <PlayerMiniBarShell fullPlayerOpen={fullPlayerOpen}>
      <PlayerMiniBarProgressLayer
        busy={progress.busy}
        useWaveform={progress.useWaveform}
        waveformPeaks={progress.waveformPeaks}
        playedFraction={progress.playedFraction}
        durationSeconds={progress.durationSeconds}
        isPlaying={progress.isPlaying}
        progressPercent={progress.progressPercent}
      />
      <PlayerMiniBarContentRow>
        <PlayerMiniBarGestureZone
          swipeGestures={swipeGestures}
          item={item}
          api={api}
          belt={belt}
        />
        {!swipeGestures ? <PlayerMiniBarTransportButtons /> : null}
        <PlayerMiniBarQueueButton />
        <PlayerMiniBarFullPlayerButton />
      </PlayerMiniBarContentRow>
    </PlayerMiniBarShell>
  );
}
