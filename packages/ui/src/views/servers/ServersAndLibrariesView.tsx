import { useCallback, useMemo, type SyntheticEvent } from "react";
import { useI18n, useT } from "@asmusic/i18n";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AppBar,
  Box,
  Container,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Toolbar,
} from "@mui/material";
import { useOfflineDownload } from "../../contexts/OfflineDownloadContext";
import {
  SettingsPreferenceListItem,
  SettingsPreferenceRow,
  SettingsPreferenceRowLabel,
} from "../settings/SettingsPreferenceRow";
import {
  SettingsListItemCaption,
  SettingsListItemTitle,
} from "../settings/SettingsTypography";
import { PageCloseButton } from "../../shared/PageCloseButton";
import {
  SettingsAppBarTitle,
  SettingsPageDescription,
} from "../settings/SettingsTypography";
import { useServerAndLibrary } from "../../contexts";
import { LibrarySelectorView } from "./LibrarySelectorView";
import { ServerManagerView } from "./ServerManagerView";
import { playerDockPaddingBottomSx } from "../../player/core/constants";

function tabIndexFromParam(tab: string | null): number {
  return tab === "libraries" ? 1 : 0;
}

export function ServersAndLibrariesView() {
  const t = useT();
  const { format } = useI18n();
  const navigate = useNavigate();
  const { servers, activeLibraryRefs, isRestoring } = useServerAndLibrary();
  const { persistWhileStreaming, setPersistWhileStreaming } = useOfflineDownload();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => tabIndexFromParam(searchParams.get("tab")),
    [searchParams],
  );

  const setTab = useCallback(
    (_: SyntheticEvent, next: number) => {
      const value = next === 1 ? "libraries" : "servers";
      setSearchParams({ tab: value }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <Box
      sx={{
        minHeight:
          "calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))",
        bgcolor: "background.default",
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky">
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton edge="start" onClick={() => navigate("/settings")} />
          <SettingsAppBarTitle>{t("servers.serversLibraries.title")}</SettingsAppBarTitle>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {isRestoring ? (
          <SettingsPageDescription sx={{ mb: 1.5 }}>
            {t("servers.serversLibraries.loadingSaved")}
          </SettingsPageDescription>
        ) : (
          <SettingsPageDescription sx={{ mb: 1.5 }}>
            {t("servers.serversLibraries.summary", {
              servers:
                servers.length === 1
                  ? t("servers.summary.oneServer")
                  : t("servers.summary.manyServers", { count: format.number(servers.length) }),
              libraries:
                activeLibraryRefs.length === 1
                  ? t("servers.summary.oneLibrary")
                  : t("servers.summary.manyLibraries", {
                      count: format.number(activeLibraryRefs.length),
                    }),
            })}
          </SettingsPageDescription>
        )}
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "background.paper",
            }}
          >
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("servers.serversLibraries.persistWhileStreaming")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("servers.serversLibraries.persistWhileStreaming.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={persistWhileStreaming}
                  onChange={(_, c) => void setPersistWhileStreaming(c)}
                  aria-label={t("servers.serversLibraries.persistWhileStreaming")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
          </Paper>
        </Stack>
        <Tabs
          value={tab}
          onChange={setTab}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("servers.tab.servers")} id="servers-tab" aria-controls="servers-panel" />
          <Tab
            label={t("servers.libraries.tab")}
            id="libraries-tab"
            aria-controls="libraries-panel"
          />
        </Tabs>
        <Box
          id="servers-panel"
          role="tabpanel"
          aria-labelledby="servers-tab"
          hidden={tab !== 0}
          sx={{ pt: 2, display: tab === 0 ? "block" : "none" }}
        >
          <ServerManagerView embedded />
        </Box>
        <Box
          id="libraries-panel"
          role="tabpanel"
          aria-labelledby="libraries-tab"
          hidden={tab !== 1}
          sx={{ pt: 2, display: tab === 1 ? "block" : "none" }}
        >
          <LibrarySelectorView embedded />
        </Box>
      </Container>
    </Box>
  );
}
