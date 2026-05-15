import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";

export type PlayingQueueViewClearDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function PlayingQueueViewClearDialog({
  open,
  onClose,
  onConfirm,
}: PlayingQueueViewClearDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("queue.clear.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{t("queue.clear.body")}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          {t("common.clear")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
