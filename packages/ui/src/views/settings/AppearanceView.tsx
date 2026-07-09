import { localeAutonym, SUPPORTED_LOCALES, useT } from "@asmusic/i18n";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Contrast from "@mui/icons-material/Contrast";
import DarkMode from "@mui/icons-material/DarkMode";
import LightMode from "@mui/icons-material/LightMode";
import {
  Divider,
  List,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import {
  setAppAppearanceMode,
  useAppAppearanceMode,
  type AppAppearanceMode,
} from "@ui/preferences/appearanceMode";
import {
  setBlackBackgroundEnabled,
  useBlackBackgroundEnabled,
} from "@ui/preferences/blackBackgroundPreference";
import { useAppPaletteMode } from "@ui/preferences/useAppPaletteMode";
import {
  setDisplayLanguagePreference,
  useDisplayLanguagePreference,
  type DisplayLanguagePreference,
} from "@ui/preferences/displayLanguagePreference";
import { SettingsPageLayout } from "./SettingsPageLayout";
import {
  SettingsPreferenceListItem,
  SettingsPreferenceRow,
  SettingsPreferenceRowLabel,
} from "./SettingsPreferenceRow";
import {
  SettingsListItemCaption,
  SettingsListItemTitle,
} from "./SettingsTypography";

type LanguageOption = { value: DisplayLanguagePreference; label: string };

function useLanguageOptions(t: ReturnType<typeof useT>): LanguageOption[] {
  return useMemo(
    () => [
      { value: "system", label: t("settings.ux.language.system") },
      ...SUPPORTED_LOCALES.map((locale) => ({
        value: locale,
        label: localeAutonym(locale),
      })),
    ],
    [t],
  );
}

export function AppearanceView() {
  const t = useT();
  const navigate = useNavigate();
  const displayLanguage = useDisplayLanguagePreference();
  const languageOptions = useLanguageOptions(t);
  const appearanceMode = useAppAppearanceMode();
  const paletteMode = useAppPaletteMode();
  const blackBackground = useBlackBackgroundEnabled();
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/settings"));

  return (
    <SettingsPageLayout
      title={t("settings.appearance")}
      onClose={() => navigate("/settings")}
      closeButtonProps={{
        tooltip: t("common.backToSettings"),
        "aria-label": t("common.backToSettings"),
      }}
      edgeSwipeBack={edgeSwipeBack}
    >
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          <List disablePadding>
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("settings.ux.appearance")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.appearance.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={appearanceMode}
                  onChange={(_, v: AppAppearanceMode | null) =>
                    v != null && setAppAppearanceMode(v)
                  }
                  aria-label={t("settings.ux.appearance")}
                  sx={{
                    flexShrink: 0,
                    "& .MuiToggleButton-root": {
                      px: 1,
                      py: 0.5,
                    },
                  }}
                >
                  <Tooltip title={t("settings.ux.appearance.light")}>
                    <ToggleButton
                      value="light"
                      aria-label={t("settings.ux.appearance.light")}
                    >
                      <LightMode fontSize="small" />
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title={t("settings.ux.appearance.auto")}>
                    <ToggleButton
                      value="auto"
                      aria-label={t("settings.ux.appearance.auto")}
                    >
                      <Contrast fontSize="small" />
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title={t("settings.ux.appearance.dark")}>
                    <ToggleButton
                      value="dark"
                      aria-label={t("settings.ux.appearance.dark")}
                    >
                      <DarkMode fontSize="small" />
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("settings.ux.appearance.blackBackground")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.appearance.blackBackground.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={blackBackground}
                  disabled={paletteMode !== "dark"}
                  onChange={(_, c) => setBlackBackgroundEnabled(c)}
                  aria-label={t("settings.ux.appearance.blackBackground")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow align="center">
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("settings.ux.language")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.language.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Select
                  size="small"
                  value={displayLanguage}
                  onChange={(e) =>
                    setDisplayLanguagePreference(
                      e.target.value as DisplayLanguagePreference,
                    )
                  }
                  inputProps={{ "aria-label": t("settings.ux.language") }}
                  sx={{
                    flexShrink: 0,
                    minWidth: { xs: 140, sm: 180 },
                    maxWidth: { xs: "52%", sm: 220 },
                    "& .MuiSelect-select": {
                      py: 0.75,
                      fontSize: { xs: "0.8125rem", sm: "0.875rem" },
                    },
                  }}
                >
                  {languageOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
          </List>
        </Paper>
      </Stack>
    </SettingsPageLayout>
  );
}
