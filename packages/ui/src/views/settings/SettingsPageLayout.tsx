import {
  AppBar,
  Box,
  Container,
  Toolbar,
  type SxProps,
  type Theme,
} from "@mui/material";
import type { ReactNode } from "react";
import {
  PageCloseButton,
  type PageCloseButtonProps,
} from "@ui/shared/PageCloseButton";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";
import { SettingsAppBarTitle } from "./SettingsTypography";

const pageHeightSx = {
  height: "calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))",
  minHeight: 0,
} as const;

export type SettingsPageLayoutProps = {
  title: ReactNode;
  onClose: () => void;
  closeButtonProps?: Pick<PageCloseButtonProps, "tooltip" | "aria-label">;
  edgeSwipeBack?: Record<string, unknown>;
  children: ReactNode;
  /** When false, children manage their own scroll regions (e.g. tab panels). */
  scrollBody?: boolean;
  contentSx?: SxProps<Theme>;
};

export function SettingsPageLayout({
  title,
  onClose,
  closeButtonProps,
  edgeSwipeBack,
  children,
  scrollBody = true,
  contentSx,
}: SettingsPageLayoutProps) {
  return (
    <Box
      {...edgeSwipeBack}
      sx={{
        ...pageHeightSx,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky" sx={{ flexShrink: 0 }}>
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton
            edge="start"
            onClick={onClose}
            {...closeButtonProps}
          />
          <SettingsAppBarTitle>{title}</SettingsAppBarTitle>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          ...libraryFlexFillSx,
          overflow: scrollBody ? "auto" : "hidden",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Container
          maxWidth="sm"
          sx={{
            py: 3,
            ...(scrollBody
              ? {}
              : {
                  ...libraryFlexFillSx,
                  display: "flex",
                  flexDirection: "column",
                }),
            ...contentSx,
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
}
