import { AddToPlaylistDialog } from "../../shared/AddToPlaylistDialog";
import type { PlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";

export type PlayerFullScreenAddToPlaylistDialogProps = {
  actions: PlayerFullScreenTrackActions;
};

export function PlayerFullScreenAddToPlaylistDialog({
  actions,
}: PlayerFullScreenAddToPlaylistDialogProps) {
  const {
    addToPlaylistOpen,
    setAddToPlaylistOpen,
    playlistsForCurrentTrack,
    addToPlaylist,
  } = actions;

  return (
    <AddToPlaylistDialog
      open={addToPlaylistOpen}
      playlists={playlistsForCurrentTrack}
      error={null}
      onClose={() => setAddToPlaylistOpen(false)}
      onPick={addToPlaylist}
    />
  );
}
