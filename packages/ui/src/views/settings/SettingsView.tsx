import ChevronRight from "@mui/icons-material/ChevronRight";
import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Toolbar,
} from "@mui/material";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import {
  SettingsAppBarTitle,
  SettingsListItemCaption,
  SettingsListItemTitle,
  SettingsPageDescription,
} from "./SettingsTypography";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";

export function SettingsView() {
  const t = useT();
  const navigate = useNavigate();
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/"));

  return (
    <Box
      {...edgeSwipeBack}
      sx={{
        minHeight:
          "calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))",
        bgcolor: "background.default",
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky">
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton edge="start" onClick={() => navigate("/")} />
          <SettingsAppBarTitle>{t("settings.title")}</SettingsAppBarTitle>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <SettingsPageDescription>
          {t("settings.description")}
        </SettingsPageDescription>

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
              onClick={() => navigate("/settings/user-experience")}
              sx={{ py: 1.5, px: 2 }}
            >
              <ListItemText
                disableTypography
                primary={
                  <>
                    <SettingsListItemTitle kind="nav">
                      {t("settings.userExperience")}
                    </SettingsListItemTitle>
                    <SettingsListItemCaption>
                      {t("settings.userExperience.caption")}
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
          </List>
        </Paper>
      </Container>
    </Box>
  );
}
