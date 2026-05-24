import Box from "@mui/material/Box";
import { useEffect, type ReactNode } from "react";
import { PLAYER_MINI_BAR_COMPACT_PX } from "../core/constants";

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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal
      sx={{
        position: "fixed",
        top: "var(--safe-area-top, 0px)",
        left: "var(--safe-area-left, 0px)",
        right: "var(--safe-area-right, 0px)",
        bottom: "var(--safe-area-bottom, 0px)",
        zIndex: (theme) => theme.zIndex.modal,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        bgcolor: "background.default",
        pb: `${PLAYER_MINI_BAR_COMPACT_PX}px`,
      }}
    >
      {children}
    </Box>
  );
}
