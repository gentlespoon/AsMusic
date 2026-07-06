import type { ReactNode } from "react";
import {
  AppBar,
  Box,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
} from "@mui/material";
import Album from "@mui/icons-material/Album";
import Download from "@mui/icons-material/Download";
import Menu from "@mui/icons-material/Menu";
import MusicNote from "@mui/icons-material/MusicNote";
import Person from "@mui/icons-material/Person";
import QueueMusic from "@mui/icons-material/QueueMusic";
import Star from "@mui/icons-material/Star";
import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import { useLibraryBrowserTabBar } from "./library/browser/useLibraryBrowserTabBar";
import { useServerAndLibrary } from "@ui/contexts";

const TAB_LABEL_CLASS = "HomePageAppBar-tabLabel";

const libraryToggleGroupSx = {
  flexShrink: 0,
  "& .MuiToggleButton-root": {
    px: 1,
    minWidth: 40,
    gap: 0.25,
  },
  "@container homeAppBar (min-width: 600px)": {
    "& .MuiToggleButton-root": {
      px: 1.25,
      minWidth: "auto",
    },
    [`& .${TAB_LABEL_CLASS}`]: {
      display: "inline",
    },
  },
} as const;

const tabLabelSx = {
  display: "none",
  ml: 0.5,
  typography: "caption",
  lineHeight: 1,
  textTransform: "none",
} as const;

export type HomePageAppBarProps = {
  onOpenNav: () => void;
};

function LibraryTabToggle({
  value,
  label,
  icon,
  id,
}: {
  value: string;
  label: string;
  icon: ReactNode;
  id?: string;
}) {
  return (
    <Tooltip title={label}>
      <ToggleButton value={value} aria-label={label} id={id}>
        {icon}
        <Box component="span" className={TAB_LABEL_CLASS} sx={tabLabelSx}>
          {label}
        </Box>
      </ToggleButton>
    </Tooltip>
  );
}

export function HomePageAppBar({ onOpenNav }: HomePageAppBarProps) {
  const t = useT();
  const { isRestoring } = useServerAndLibrary();
  const { tab, selectTab, hasLibraries } = useLibraryBrowserTabBar();
  const navigate = useNavigate();

  return (
    <AppBar position="sticky">
      <Toolbar
        variant="dense"
        sx={{
          gap: 1,
          flexWrap: "nowrap",
          px: { xs: 1, sm: 2 },
          containerType: "inline-size",
          containerName: "homeAppBar",
        }}
      >
        <IconButton
          edge="start"
          color="inherit"
          aria-label={t("home.appBar.openNavMenu")}
          onClick={onOpenNav}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          <Menu sx={{ fontSize: 22 }} />
        </IconButton>

        {hasLibraries && !isRestoring && (
          <>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={tab}
                onChange={(_, next) => {
                  if (next == null) return;
                  selectTab(next);
                }}
                aria-label={t("home.appBar.librarySection")}
                sx={libraryToggleGroupSx}
              >
                <LibraryTabToggle
                  value="artists"
                  label={t("home.appBar.artists")}
                  icon={<Person sx={{ fontSize: 22 }} />}
                />
                <LibraryTabToggle
                  value="albums"
                  label={t("home.appBar.albums")}
                  icon={<Album sx={{ fontSize: 22 }} />}
                />
                <LibraryTabToggle
                  value="songs"
                  label={t("home.appBar.songs")}
                  id="library-tab-2"
                  icon={<MusicNote sx={{ fontSize: 22 }} />}
                />
                <LibraryTabToggle
                  value="playlists"
                  label={t("home.appBar.playlists")}
                  id="library-tab-playlists"
                  icon={<QueueMusic sx={{ fontSize: 22 }} />}
                />
                <LibraryTabToggle
                  value="favorites"
                  label={t("home.appBar.favorites")}
                  id="library-tab-favorites"
                  icon={<Star sx={{ fontSize: 22 }} />}
                />
              </ToggleButtonGroup>
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={tab}
              onChange={(_, next) => {
                if (next == null) return;
                if (next === "offline") {
                  navigate("/offline");
                  return;
                }
                selectTab(next);
              }}
              aria-label={t("home.appBar.librarySection")}
              sx={libraryToggleGroupSx}
            >
              <LibraryTabToggle
                value="offline"
                label={t("home.appBar.offline")}
                icon={<Download sx={{ fontSize: 22 }} />}
              />
            </ToggleButtonGroup>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
