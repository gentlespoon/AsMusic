import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import type { PlayerQueueItem, PlayerViewState } from "../core/types";
import { PlayerFullScreenPlaybackControls } from "./PlayerFullScreenPlaybackControls";
import { PlayerFullScreenProgressBar } from "./PlayerFullScreenProgressBar";
import { PlayerFullScreenTrackDisplay } from "./PlayerFullScreenTrackDisplay";

export type PlayerFullScreenBodyProps = {
  item: PlayerQueueItem | null;
  state: PlayerViewState;
  onClose: () => void;
};

export function PlayerFullScreenBody({
  item,
  state,
  onClose,
}: PlayerFullScreenBodyProps) {
  const t = useT();

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: { xs: 2, sm: 3 },
        py: 2,
        overflow: "auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {!item ? (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mt: 4, textAlign: "center", maxWidth: 320 }}
        >
          {t("player.fullScreen.empty")}
        </Typography>
      ) : (
        <>
          <PlayerFullScreenTrackDisplay />

          {state.loadError ? (
            <Typography
              variant="body2"
              color="error"
              sx={{ mt: 2, textAlign: "center" }}
            >
              {state.loadError}
            </Typography>
          ) : null}

          <PlayerFullScreenProgressBar />
          <PlayerFullScreenPlaybackControls />
        </>
      )}

      {!item ? (
        <Button sx={{ mt: 4 }} variant="outlined" onClick={onClose}>
          {t("player.fullScreen.backToLibrary")}
        </Button>
      ) : null}
    </Box>
  );
}
