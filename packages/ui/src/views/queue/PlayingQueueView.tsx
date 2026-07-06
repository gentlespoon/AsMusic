import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePlayerActions,
  usePlayerTransportState,
} from "@ui/contexts/PlayerContext";
import { PlayingQueueViewAppBar } from "./PlayingQueueViewAppBar";
import { PlayingQueueViewClearDialog } from "./PlayingQueueViewClearDialog";
import { PlayingQueueViewList } from "./PlayingQueueViewList";
import { PlayingQueueViewRowMenu } from "./PlayingQueueViewRowMenu";
import type { PlayingQueueViewRowMenuAnchor } from "./PlayingQueueViewRowMenu";
import { PlayingQueueViewShell } from "./PlayingQueueViewShell";
import { PLAYING_QUEUE_PATH } from "./playingQueuePath";
import { usePlayingQueueScroll } from "./usePlayingQueueScroll";

export { PLAYING_QUEUE_PATH };

export type PlayingQueueViewProps = {
  /**
   * When true, renders only the queue body (toolbar + list + dialogs) so a parent can supply its own chrome.
   * When false (default), renders a full-page shell with AppBar and back navigation.
   */
  embedded?: boolean;
  /** Called when the user taps back in full-page mode. Defaults to `navigate(-1)`. */
  onBack?: () => void;
};

/**
 * Playback queue: toolbar actions, virtualized list, row menu, and clear confirmation.
 * Use as a **route** (`embedded={false}`) or embed inside another layout (`embedded`).
 */
export function PlayingQueueView({
  embedded = false,
  onBack,
}: PlayingQueueViewProps) {
  const navigate = useNavigate();
  const state = usePlayerTransportState();
  const {
    playQueueIndex,
    removeQueueIndex,
    duplicateQueueIndexToEnd,
    moveQueueIndexToPlayNext,
    clearQueueExceptCurrent,
    reshuffleQueuePreservingCurrent,
    toggleLoopQueue,
    toggleLoopOne,
  } = usePlayerActions();

  const scroll = usePlayingQueueScroll(state);
  const [clearOpen, setClearOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] =
    useState<PlayingQueueViewRowMenuAnchor | null>(null);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  }, [navigate, onBack]);

  const toolbar = {
    queueLength: state.queue.length,
    loopQueue: state.loopQueue,
    loopOne: state.loopOne,
    onShuffle: () => void reshuffleQueuePreservingCurrent(),
    onToggleLoopQueue: () => toggleLoopQueue(),
    onToggleLoopOne: () => toggleLoopOne(),
    onClearClick: () => setClearOpen(true),
  };

  return (
    <PlayingQueueViewShell embedded={embedded}>
      {embedded ? null : (
        <PlayingQueueViewAppBar onBack={handleBack} toolbar={toolbar} />
      )}
      <PlayingQueueViewList
        state={state}
        scroll={scroll}
        onPlayIndex={(index) => void playQueueIndex(index)}
        onOpenRowMenu={(el, index) => setMenuAnchor({ el, index })}
      />
      <PlayingQueueViewRowMenu
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onPlayNext={moveQueueIndexToPlayNext}
        onAddToQueue={duplicateQueueIndexToEnd}
        onRemove={(index) => void removeQueueIndex(index)}
      />
      <PlayingQueueViewClearDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearQueueExceptCurrent();
          setClearOpen(false);
        }}
      />
    </PlayingQueueViewShell>
  );
}
