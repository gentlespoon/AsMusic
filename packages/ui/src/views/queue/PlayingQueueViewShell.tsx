import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";

export type PlayingQueueViewShellProps = {
  embedded: boolean;
  children: ReactNode;
};

export function PlayingQueueViewShell({
  embedded,
  children,
}: PlayingQueueViewShellProps) {
  if (embedded) {
    return (
      <Box
        sx={{
          ...libraryFlexFillSx,
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "hidden",
        ...playerDockPaddingBottomSx,
      }}
    >
      {children}
    </Box>
  );
}
