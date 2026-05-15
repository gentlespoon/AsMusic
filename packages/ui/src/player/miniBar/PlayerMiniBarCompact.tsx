import { usePlayerShell } from "../../contexts/PlayerContext";
import { PlayerMiniBarContentRow } from "./PlayerMiniBarContentRow";
import { PlayerMiniBarFullPlayerButton } from "./PlayerMiniBarFullPlayerButton";
import { PlayerMiniBarQueueButton } from "./PlayerMiniBarQueueButton";
import { PlayerMiniBarShell } from "./PlayerMiniBarShell";

/** Mini bar chrome when the full-screen player is open: queue + minimize only. */
export function PlayerMiniBarCompact() {
  const { fullPlayerOpen } = usePlayerShell();

  return (
    <PlayerMiniBarShell fullPlayerOpen={fullPlayerOpen}>
      <PlayerMiniBarContentRow compact>
        <PlayerMiniBarQueueButton />
        <PlayerMiniBarFullPlayerButton />
      </PlayerMiniBarContentRow>
    </PlayerMiniBarShell>
  );
}
