import Dialog from "@mui/material/Dialog";
import type { ReactNode } from "react";

export type PlayerFullScreenShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function PlayerFullScreenShell({
  open,
  onClose,
  children,
}: PlayerFullScreenShellProps) {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxHeight: "100dvh",
            overflow: "hidden",
            boxSizing: "border-box",
            pt: "env(safe-area-inset-top, 0px)",
            pl: "env(safe-area-inset-left, 0px)",
            pr: "env(safe-area-inset-right, 0px)",
            pb: "env(safe-area-inset-bottom, 0px)",
          },
        },
      }}
    >
      {children}
    </Dialog>
  );
}
