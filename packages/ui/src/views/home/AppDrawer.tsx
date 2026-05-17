import { useState } from "react";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import { PageCloseButton } from "../../shared/PageCloseButton";
import {
  formatSleepTimerRemaining,
  SleepTimerDialog,
  useSleepTimerRemainingSeconds,
} from "../../player/sleepTimer/SleepTimerDialog";
import { PLAYING_QUEUE_PATH } from "../queue/PlayingQueueView";

const DRAWER_WIDTH = 280;

export type AppDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const t = useT();
  const navigate = useNavigate();
  const [sleepTimerOpen, setSleepTimerOpen] = useState(false);
  const sleepRemainingSeconds = useSleepTimerRemainingSeconds();
  const sleepTimerActive =
    sleepRemainingSeconds != null && sleepRemainingSeconds > 0;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              width: DRAWER_WIDTH,
              maxWidth: "85vw",
              pt: "var(--safe-area-top, 0px)",
              pb: "var(--safe-area-bottom, 0px)",
              boxSizing: "border-box",
            },
          },
        }}
      >
        <Box
          sx={{
            px: 1,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <PageCloseButton edge="start" onClick={onClose} />
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ fontWeight: 600, letterSpacing: 0.5 }}
          >
            {t("nav.title")}
          </Typography>
        </Box>
        <Divider />
        <List dense sx={{ py: 0.5 }}>
          <ListItemButton onClick={() => go("/about")}>
            <ListItemText primary={t("nav.about")} secondary={t("nav.aboutHint")} />
          </ListItemButton>
          <ListItemButton onClick={() => go("/settings")}>
            <ListItemText
              primary={t("nav.settings")}
              secondary={t("nav.settingsHint")}
            />
          </ListItemButton>
          <ListItemButton onClick={() => go(PLAYING_QUEUE_PATH)}>
            <ListItemText
              primary={t("nav.playbackQueue")}
              secondary={t("nav.playbackQueueHint")}
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => setSleepTimerOpen(true)}
            sx={(theme) =>
              sleepTimerActive
                ? {
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.18),
                    },
                    "& .MuiListItemText-primary": {
                      color: "primary.main",
                      fontWeight: 600,
                    },
                    "& .MuiListItemText-secondary": {
                      color: alpha(theme.palette.primary.main, 0.85),
                    },
                  }
                : {}
            }
          >
            <ListItemText
              primary={t("nav.sleepTimer")}
              secondary={
                sleepTimerActive
                  ? t("nav.sleepTimerRemaining", {
                      remaining: formatSleepTimerRemaining(sleepRemainingSeconds),
                    })
                  : t("nav.sleepTimerHint")
              }
            />
          </ListItemButton>
        </List>
      </Drawer>
      <SleepTimerDialog
        open={sleepTimerOpen}
        onClose={() => setSleepTimerOpen(false)}
      />
    </>
  );
}
