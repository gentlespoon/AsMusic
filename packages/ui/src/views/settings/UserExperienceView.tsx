import { localeAutonym, SUPPORTED_LOCALES, useT } from "@asmusic/i18n";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Container,
  Divider,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
} from "@mui/material";
import { PageCloseButton } from "../../shared/PageCloseButton";
import {
  SettingsPreferenceListItem,
  SettingsPreferenceRow,
  SettingsPreferenceRowLabel,
} from "./SettingsPreferenceRow";
import { SettingsPreferenceSection } from "./SettingsPreferenceSection";
import {
  SettingsAppBarTitle,
  SettingsListItemCaption,
  SettingsListItemTitle,
  SettingsPageDescription,
} from "./SettingsTypography";
import {
  setAppAppearanceMode,
  useAppAppearanceMode,
  type AppAppearanceMode,
} from "../../preferences/appearanceMode";
import {
  setHapticFeedbackEnabled,
  useHapticFeedbackEnabled,
} from "../../preferences/hapticFeedbackPreference";
import {
  setWaveformProgressBarEnabled,
  useWaveformProgressBarEnabled,
} from "../../preferences/waveformProgressBarPreference";
import { playerDockPaddingBottomSx } from "../../player/core/constants";
import {
  setMiniPlayerSwipeGesturesEnabled,
  useMiniPlayerSwipeGesturesEnabled,
} from "../../player/miniBar/miniPlayerPreferences";
import {
  setDisplayLanguagePreference,
  useDisplayLanguagePreference,
  type DisplayLanguagePreference,
} from "../../preferences/displayLanguagePreference";

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
    [t]
  );
}

export function UserExperienceView() {
  const t = useT();
  const navigate = useNavigate();
  const displayLanguage = useDisplayLanguagePreference();
  const languageOptions = useLanguageOptions(t);
  const miniBarSwipeGestures = useMiniPlayerSwipeGesturesEnabled();
  const appearanceMode = useAppAppearanceMode();
  const hapticEnabled = useHapticFeedbackEnabled();
  const waveformProgressBar = useWaveformProgressBarEnabled();

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
          <PageCloseButton
            edge="start"
            tooltip={t("common.backToSettings")}
            aria-label={t("common.backToSettings")}
            onClick={() => navigate("/settings")}
          />
          <SettingsAppBarTitle>{t("settings.userExperience")}</SettingsAppBarTitle>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <SettingsPageDescription>{t("settings.ux.description")}</SettingsPageDescription>

        <Stack spacing={3}>
          <SettingsPreferenceSection title={t("settings.ux.section.appearance")}>
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>{t("settings.ux.appearance")}</SettingsListItemTitle>
                  <SettingsListItemCaption>{t("settings.ux.appearance.caption")}</SettingsListItemCaption>
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
                      px: { xs: 0.65, sm: 1 },
                      py: 0.25,
                      fontSize: { xs: "0.75rem", sm: "0.8125rem" },
                      textTransform: "none",
                    },
                  }}
                >
                  <ToggleButton value="light">{t("settings.ux.appearance.light")}</ToggleButton>
                  <ToggleButton value="auto">{t("settings.ux.appearance.auto")}</ToggleButton>
                  <ToggleButton value="dark">{t("settings.ux.appearance.dark")}</ToggleButton>
                </ToggleButtonGroup>
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow align="center">
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>{t("settings.ux.language")}</SettingsListItemTitle>
                  <SettingsListItemCaption>{t("settings.ux.language.caption")}</SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Select
                  size="small"
                  value={displayLanguage}
                  onChange={(e) =>
                    setDisplayLanguagePreference(e.target.value as DisplayLanguagePreference)
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
          </SettingsPreferenceSection>

          <SettingsPreferenceSection title={t("settings.ux.section.playback")}>
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>{t("settings.ux.playerBarSwipe")}</SettingsListItemTitle>
                  <SettingsListItemCaption>{t("settings.ux.playerBarSwipe.caption")}</SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={miniBarSwipeGestures}
                  onChange={(_, c) => setMiniPlayerSwipeGesturesEnabled(c)}
                  aria-label={t("settings.ux.playerBarSwipe")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>{t("settings.ux.waveform")}</SettingsListItemTitle>
                  <SettingsListItemCaption>{t("settings.ux.waveform.caption")}</SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={waveformProgressBar}
                  onChange={(_, c) => setWaveformProgressBarEnabled(c)}
                  aria-label={t("settings.ux.waveform")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow align="center">
                <SettingsListItemTitle sx={{ flex: 1 }}>{t("settings.ux.haptics")}</SettingsListItemTitle>
                <Switch
                  checked={hapticEnabled}
                  onChange={(_, c) => setHapticFeedbackEnabled(c)}
                  aria-label={t("settings.ux.haptics")}
                  sx={{ flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
          </SettingsPreferenceSection>
        </Stack>
      </Container>
    </Box>
  );
}
