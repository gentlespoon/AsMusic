import { useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import {
  usePlayerActions,
  usePlayerShell,
  usePlayerTransportState,
} from "@ui/contexts/PlayerContext";
import { useServerTranscodeEnabled } from "@ui/preferences/serverTranscodePreference";
import { buildPlayerFullScreenTrackMeta } from "./buildPlayerFullScreenTrackMeta";
import { PlayerFullScreenAddToPlaylistDialog } from "./PlayerFullScreenAddToPlaylistDialog";
import { PlayerFullScreenAppBar } from "./PlayerFullScreenAppBar";
import { PlayerFullScreenBody } from "./PlayerFullScreenBody";
import { PlayerFullScreenErrorAlerts } from "./PlayerFullScreenErrorAlerts";
import { PlayerFullScreenShell } from "./PlayerFullScreenShell";
import { PlayerFullScreenTrackInfoDialog } from "./PlayerFullScreenTrackInfoDialog";
import { usePlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";

export function PlayerFullScreen() {
  const t = useT();
  const state = usePlayerTransportState();
  const { fullPlayerOpen } = usePlayerShell();
  const { closeFullPlayer } = usePlayerActions();
  const serverTranscodeEnabled = useServerTranscodeEnabled();
  const item = state.currentItem;

  const [trackInfoOpen, setTrackInfoOpen] = useState(false);
  const actions = usePlayerFullScreenTrackActions(item);
  const metaRows = buildPlayerFullScreenTrackMeta(
    item,
    t,
    serverTranscodeEnabled,
  );

  useEffect(() => {
    if (!item) setTrackInfoOpen(false);
  }, [item]);

  return (
    <PlayerFullScreenShell
      open={fullPlayerOpen}
      onClose={() => closeFullPlayer()}
    >
      <PlayerFullScreenAppBar
        onClose={() => closeFullPlayer()}
        item={item}
        actions={actions}
        onTrackInfo={() => setTrackInfoOpen(true)}
      />
      <PlayerFullScreenErrorAlerts actions={actions} />
      <PlayerFullScreenAddToPlaylistDialog actions={actions} />
      <PlayerFullScreenTrackInfoDialog
        open={trackInfoOpen}
        onClose={() => setTrackInfoOpen(false)}
        metaRows={metaRows}
      />
      <PlayerFullScreenBody
        item={item}
        state={state}
        onClose={() => closeFullPlayer()}
      />
    </PlayerFullScreenShell>
  );
}
