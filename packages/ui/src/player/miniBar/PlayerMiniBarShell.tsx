import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import {
  PLAYER_MINI_BAR_BASE_PX,
  PLAYER_MINI_BAR_COMPACT_PX,
} from "../core/constants";

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
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) =>
          fullPlayerOpen ? theme.zIndex.modal + 1 : theme.zIndex.appBar + 1,
        pb: "env(safe-area-inset-bottom, 0px)",
        minHeight: fullPlayerOpen
          ? PLAYER_MINI_BAR_COMPACT_PX
          : PLAYER_MINI_BAR_BASE_PX,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        pl: "calc(16px + env(safe-area-inset-left, 0px))",
        pr: "calc(16px + env(safe-area-inset-right, 0px))",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
