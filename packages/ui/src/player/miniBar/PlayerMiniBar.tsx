import { usePlayerShell } from "@ui/contexts/PlayerContext";
import { PlayerMiniBarCompact } from "./PlayerMiniBarCompact";
import { PlayerMiniBarExpanded } from "./PlayerMiniBarExpanded";

export function PlayerMiniBar() {
  const { fullPlayerOpen } = usePlayerShell();
  return fullPlayerOpen ? <PlayerMiniBarCompact /> : <PlayerMiniBarExpanded />;
}
