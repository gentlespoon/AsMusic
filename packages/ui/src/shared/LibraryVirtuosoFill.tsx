import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Flex child that grows to fill a column layout. `flex-basis: 0` avoids iOS WebKit leaving
 * unused space below scrollers that only use `flex: 1` (auto basis).
 */
export const libraryFlexFillSx = {
  flex: "1 1 0",
  minHeight: 0,
  minWidth: 0,
  alignSelf: "stretch",
} as const;

/**
 * Gives Virtuoso / VirtuosoGrid a definite height inside flex layouts. WebKit (iOS) often
 * does not stretch `flex: 1` scrollers correctly; an inset-0 box avoids a blank gap at the bottom.
 */
export function LibraryVirtuosoFill({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        width: "100%",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          "& > *": {
            ...libraryFlexFillSx,
            position: "relative",
            height: "100%",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
