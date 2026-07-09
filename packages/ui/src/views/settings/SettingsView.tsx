import ChevronRight from "@mui/icons-material/ChevronRight";
import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import {
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
} from "@mui/material";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import { SettingsPageLayout } from "./SettingsPageLayout";
import {
  SettingsListItemCaption,
  SettingsListItemTitle,
  SettingsPageDescription,
} from "./SettingsTypography";

export function SettingsView() {
  const t = useT();
  const navigate = useNavigate();
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/"));

  return (
    <SettingsPageLayout
      title={t("settings.title")}
      onClose={() => navigate("/")}
      edgeSwipeBack={edgeSwipeBack}
    >
      {/* <SettingsPageDescription>
        {t("settings.description")}
      </SettingsPageDescription> */}

      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <List disablePadding>
          <ListItemButton
            onClick={() => navigate("/settings/appearance")}
            sx={{ py: 1.5, px: 2 }}
          >
            <ListItemText
              disableTypography
              primary={
                <>
                  <SettingsListItemTitle kind="nav">
                    {t("settings.appearance")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.appearance.caption")}
                  </SettingsListItemCaption>
                </>
              }
            />
            <ChevronRight
              sx={{ color: "action.active", flexShrink: 0, ml: 0.5 }}
              fontSize="small"
            />
          </ListItemButton>

          <Divider component="li" />
          <ListItemButton
            onClick={() => navigate("/settings/playback")}
            sx={{ py: 1.5, px: 2 }}
          >
            <ListItemText
              disableTypography
              primary={
                <>
                  <SettingsListItemTitle kind="nav">
                    {t("settings.playback")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.playback.caption")}
                  </SettingsListItemCaption>
                </>
              }
            />
            <ChevronRight
              sx={{ color: "action.active", flexShrink: 0, ml: 0.5 }}
              fontSize="small"
            />
          </ListItemButton>

          <Divider component="li" />
          <ListItemButton
            onClick={() => navigate("/settings/servers-libraries")}
            sx={{ py: 1.5, px: 2 }}
          >
            <ListItemText
              disableTypography
              primary={
                <>
                  <SettingsListItemTitle kind="nav">
                    {t("settings.serversLibraries")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.serversLibraries.caption")}
                  </SettingsListItemCaption>
                </>
              }
            />
            <ChevronRight
              sx={{ color: "action.active", flexShrink: 0, ml: 0.5 }}
              fontSize="small"
            />
          </ListItemButton>
          <Divider component="li" />
          <ListItemButton
            onClick={() => navigate("/settings/developer")}
            sx={{ py: 1.5, px: 2 }}
          >
            <ListItemText
              disableTypography
              primary={
                <>
                  <SettingsListItemTitle kind="nav">
                    {t("settings.developer")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.developer.caption")}
                  </SettingsListItemCaption>
                </>
              }
            />
            <ChevronRight
              sx={{ color: "action.active", flexShrink: 0, ml: 0.5 }}
              fontSize="small"
            />
          </ListItemButton>
        </List>
      </Paper>
    </SettingsPageLayout>
  );
}
