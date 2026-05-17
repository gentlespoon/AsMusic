import Box from "@mui/material/Box";
import type { ReactNode } from "react";

export type PlayerMiniBarContentRowProps = {
  children: ReactNode;
  compact?: boolean;
};

export function PlayerMiniBarContentRow({
  children,
  compact = false,
}: PlayerMiniBarContentRowProps) {
  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 44,
        ...(compact ? { justifyContent: "flex-end" } : {}),
      }}
    >
      {children}
    </Box>
  );
}
