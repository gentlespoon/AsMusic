import { useCallback, useMemo, type SyntheticEvent } from "react";
import { useI18n, useT } from "@asmusic/i18n";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Tab, Tabs } from "@mui/material";
import { SettingsPageDescription } from "@ui/views/settings/SettingsTypography";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import { SettingsPageLayout } from "@ui/views/settings/SettingsPageLayout";
import { useServerAndLibrary } from "@ui/contexts";
import { LibrarySelectorView } from "./librarySelector";
import { ServerManagerView } from "./ServerManagerView";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";

function tabIndexFromParam(tab: string | null): number {
  return tab === "libraries" ? 1 : 0;
}

export function ServersAndLibrariesView() {
  const t = useT();
  const { format } = useI18n();
  const navigate = useNavigate();
  const { servers, activeLibraryRefs, isRestoring } = useServerAndLibrary();
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

  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/settings"));

  return (
    <SettingsPageLayout
      title={t("servers.serversLibraries.title")}
      onClose={() => navigate("/settings")}
      edgeSwipeBack={edgeSwipeBack}
      scrollBody={false}
    >
      <Box sx={{ flexShrink: 0 }}>
        {isRestoring ? (
          <>
            <SettingsPageDescription sx={{ mb: 1.5 }}>
              {t("servers.serversLibraries.loadingSaved")}
            </SettingsPageDescription>
            {/* <SettingsPageDescription> Keep this here so we can use it in the future. </SettingsPageDescription> */}
          </>
        ) : (
          <SettingsPageDescription sx={{ mb: 1.5, textAlign: "center" }}>
            {t("servers.serversLibraries.summary", {
              servers:
                servers.length === 1
                  ? t("servers.summary.oneServer")
                  : t("servers.summary.manyServers", {
                      count: format.number(servers.length),
                    }),
              libraries:
                activeLibraryRefs.length === 1
                  ? t("servers.summary.oneLibrary")
                  : t("servers.summary.manyLibraries", {
                      count: format.number(activeLibraryRefs.length),
                    }),
            })}
          </SettingsPageDescription>
        )}
        <Tabs
          value={tab}
          onChange={setTab}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            label={t("servers.tab.servers")}
            id="servers-tab"
            aria-controls="servers-panel"
          />
          <Tab
            label={t("servers.libraries.tab")}
            id="libraries-tab"
            aria-controls="libraries-panel"
          />
        </Tabs>
      </Box>
      <Box
        id="servers-panel"
        role="tabpanel"
        aria-labelledby="servers-tab"
        hidden={tab !== 0}
        sx={{
          ...libraryFlexFillSx,
          pt: 2,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          display: tab === 0 ? "block" : "none",
        }}
      >
        {tab === 0 && <ServerManagerView embedded />}
      </Box>
      <Box
        id="libraries-panel"
        role="tabpanel"
        aria-labelledby="libraries-tab"
        hidden={tab !== 1}
        sx={{
          ...libraryFlexFillSx,
          pt: 2,
          overflow: "hidden",
          display: tab === 1 ? "flex" : "none",
          flexDirection: "column",
        }}
      >
        {tab === 1 && <LibrarySelectorView embedded />}
      </Box>
    </SettingsPageLayout>
  );
}
