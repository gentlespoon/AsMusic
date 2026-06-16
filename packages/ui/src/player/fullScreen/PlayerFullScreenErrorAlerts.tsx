import Alert from "@mui/material/Alert";
import type { PlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";

export type PlayerFullScreenErrorAlertsProps = {
  actions: PlayerFullScreenTrackActions;
};

export function PlayerFullScreenErrorAlerts({
  actions,
}: PlayerFullScreenErrorAlertsProps) {
  const {
    starError,
    clearStarError,
    addToPlaylistError,
    clearAddToPlaylistError,
    refreshCoverArtError,
    clearRefreshCoverArtError,
  } = actions;

  return (
    <>
      {starError ? (
        <Alert
          severity="error"
          onClose={clearStarError}
          sx={{ borderRadius: 0, flexShrink: 0 }}
        >
          {starError}
        </Alert>
      ) : null}
      {addToPlaylistError ? (
        <Alert
          severity="error"
          onClose={clearAddToPlaylistError}
          sx={{ borderRadius: 0, flexShrink: 0 }}
        >
          {addToPlaylistError}
        </Alert>
      ) : null}
      {refreshCoverArtError ? (
        <Alert
          severity="error"
          onClose={clearRefreshCoverArtError}
          sx={{ borderRadius: 0, flexShrink: 0 }}
        >
          {refreshCoverArtError}
        </Alert>
      ) : null}
    </>
  );
}
