import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import type { PlayerFullScreenTrackMetaRow } from "./buildPlayerFullScreenTrackMeta";

export type PlayerFullScreenTrackInfoDialogProps = {
  open: boolean;
  onClose: () => void;
  metaRows: PlayerFullScreenTrackMetaRow[];
};

export function PlayerFullScreenTrackInfoDialog({
  open,
  onClose,
  metaRows,
}: PlayerFullScreenTrackInfoDialogProps) {
  const t = useT();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
    >
      <DialogTitle>{t("player.trackDetails.title")}</DialogTitle>
      <DialogContent dividers>
        <Alert
          severity="info"
          variant="outlined"
          sx={{ "& .MuiAlert-message": { width: "100%" } }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 0.75,
              columnGap: 2,
            }}
          >
            {metaRows.map((row) => (
              <Box key={row.label} sx={{ display: "contents" }}>
                <Typography variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                  {row.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
