import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import {
  usePlayerActions,
  usePlayerSleepTimer,
} from "@ui/contexts/PlayerContext";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useSleepTimerRemainingSeconds(): number | null {
  const sleepTimer = usePlayerSleepTimer();
  const [, bump] = useState(0);

  useEffect(() => {
    if (sleepTimer.sleepEndsAtEpochMs == null) return;
    const id = window.setInterval(() => bump((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimer.sleepEndsAtEpochMs]);

  if (sleepTimer.sleepEndsAtEpochMs == null) return null;
  return Math.max(
    0,
    Math.ceil((sleepTimer.sleepEndsAtEpochMs - Date.now()) / 1000),
  );
}

export function formatSleepTimerRemaining(seconds: number): string {
  return formatClock(seconds);
}

type SleepTimerDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SleepTimerDialog({ open, onClose }: SleepTimerDialogProps) {
  const t = useT();
  const { setSleepTimerMinutes, cancelSleepTimer } = usePlayerActions();
  const sleepTimer = usePlayerSleepTimer();
  const [sleepSelectionMinutes, setSleepSelectionMinutes] = useState(15);

  useEffect(() => {
    if (!open) return;
    if (sleepTimer.sleepEndsAtEpochMs != null) {
      const remMin = Math.max(
        1,
        Math.ceil((sleepTimer.sleepEndsAtEpochMs - Date.now()) / 60_000),
      );
      setSleepSelectionMinutes(Math.min(120, remMin));
    } else {
      setSleepSelectionMinutes(15);
    }
  }, [open, sleepTimer.sleepEndsAtEpochMs]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 1 }}
      >
        <PageCloseButton edge="start" onClick={onClose} />
        {t("sleepTimer.dialogTitle")}
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="h6"
          align="center"
          sx={{ fontVariantNumeric: "tabular-nums", mt: 1 }}
        >
          {t("sleepTimer.minutes", { minutes: sleepSelectionMinutes })}
        </Typography>
        <Slider
          value={sleepSelectionMinutes}
          onChange={(_, v) =>
            setSleepSelectionMinutes(Array.isArray(v) ? v[0]! : v)
          }
          min={1}
          max={120}
          step={1}
          valueLabelDisplay="off"
          sx={{ mt: 2, mb: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, flexWrap: "wrap", gap: 1 }}>
        {sleepTimer.sleepEndsAtEpochMs != null ? (
          <Button
            color="error"
            onClick={() => {
              void cancelSleepTimer();
              onClose();
            }}
          >
            {t("sleepTimer.turnOff")}
          </Button>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          onClick={() => {
            void setSleepTimerMinutes(sleepSelectionMinutes);
            onClose();
          }}
        >
          {t("sleepTimer.start")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
