import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import {
  PLAYER_MINI_BAR_BASE_PX,
  PLAYER_MINI_BAR_COMPACT_PX,
} from "@ui/player/core/constants";

export type PlayerMiniBarShellProps = {
  fullPlayerOpen: boolean;
  children: ReactNode;
};

export function PlayerMiniBarShell({
  fullPlayerOpen,
  children,
}: PlayerMiniBarShellProps) {
  return (
    <Box
      sx={{
        position: "fixed",
        left: "env(safe-area-inset-left, 0px)",
        right: "env(safe-area-inset-right, 0px)",
        bottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: (theme) =>
          fullPlayerOpen ? theme.zIndex.modal + 1 : theme.zIndex.appBar + 1,
        minHeight: fullPlayerOpen
          ? PLAYER_MINI_BAR_COMPACT_PX
          : PLAYER_MINI_BAR_BASE_PX,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        pl: 2,
        pr: 2,
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
