import { useT } from "@asmusic/i18n";
import { useState } from "react";
import { Box, Container, Typography } from "@mui/material";
import { AppDrawer } from "./AppDrawer";
import { HomePageAppBar } from "./HomePageAppBar";
import { LibraryBrowser } from "./library/LibraryBrowser";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { useServerAndLibrary } from "@ui/contexts";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";

export function HomePage() {
  const t = useT();
  const { isRestoring } = useServerAndLibrary();
  const [navOpen, setNavOpen] = useState(false);

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
      <HomePageAppBar onOpenNav={() => setNavOpen(true)} />
      <AppDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <Container
        component="main"
        maxWidth="md"
        sx={{
          ...libraryFlexFillSx,
          display: "flex",
          flexGrow: 1,
          flexDirection: "column",
          overflow: "hidden",
          px: { xs: 2, sm: 3 },
        }}
      >
        {isRestoring ? (
          <Typography variant="body2" color="text.secondary">
            {t("home.loadingServers")}
          </Typography>
        ) : (
          <LibraryBrowser />
        )}
      </Container>
    </Box>
  );
}
