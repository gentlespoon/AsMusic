import IconButton from "@mui/material/IconButton";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import { useT } from "@asmusic/i18n";
import {
  usePlayerActions,
  usePlayerShell,
} from "@ui/contexts/PlayerContext";

export function PlayerMiniBarFullPlayerButton() {
  const t = useT();
  const { fullPlayerOpen } = usePlayerShell();
  const { toggleFullPlayer } = usePlayerActions();

  const fullPlayerLabel = fullPlayerOpen
    ? t("player.action.minimize")
    : t("player.action.openFullPlayer");

  return (
    <IconButton
      aria-label={fullPlayerLabel}
      aria-pressed={fullPlayerOpen}
      size="medium"
      color={fullPlayerOpen ? "primary" : "default"}
      onClick={() => toggleFullPlayer()}
      edge="end"
      sx={{ flexShrink: 0 }}
    >
      {fullPlayerOpen ? (
        <KeyboardArrowDown fontSize="medium" />
      ) : (
        <KeyboardArrowUp fontSize="medium" />
      )}
    </IconButton>
  );
}
