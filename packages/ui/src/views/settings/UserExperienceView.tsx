import { localeAutonym, SUPPORTED_LOCALES, useT } from "@asmusic/i18n";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Contrast from "@mui/icons-material/Contrast";
import DarkMode from "@mui/icons-material/DarkMode";
import LightMode from "@mui/icons-material/LightMode";
import {
  AppBar,
  Box,
  Container,
  Divider,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import { useHost } from "@ui/host/HostContext";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
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
} from "./SettingsTypography";
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
  setHapticFeedbackEnabled,
  useHapticFeedbackEnabled,
} from "@ui/preferences/hapticFeedbackPreference";
import {
  setWaveformProgressBarEnabled,
  useWaveformProgressBarEnabled,
} from "@ui/preferences/waveformProgressBarPreference";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";
import {
  setMiniPlayerSwipeGesturesEnabled,
  useMiniPlayerSwipeGesturesEnabled,
} from "@ui/player/miniBar/miniPlayerPreferences";
import {
  setDisplayLanguagePreference,
  useDisplayLanguagePreference,
  type DisplayLanguagePreference,
} from "@ui/preferences/displayLanguagePreference";
import {
  setPlayerDebugLogMenuEnabled,
  usePlayerDebugLogMenuEnabled,
} from "@ui/preferences/playerDebugLogPreference";
import {
  PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MAX,
  PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MIN,
  setPlaybackFailureAutoSkipLimit,
  usePlaybackFailureAutoSkipLimit,
} from "@ui/preferences/playbackFailureAutoSkipLimitPreference";

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

export function UserExperienceView() {
  const t = useT();
  const host = useHost();
  const navigate = useNavigate();
  const displayLanguage = useDisplayLanguagePreference();
  const languageOptions = useLanguageOptions(t);
  const miniBarSwipeGestures = useMiniPlayerSwipeGesturesEnabled();
  const appearanceMode = useAppAppearanceMode();
  const paletteMode = useAppPaletteMode();
  const blackBackground = useBlackBackgroundEnabled();
  const hapticEnabled = useHapticFeedbackEnabled();
  const waveformProgressBar = useWaveformProgressBarEnabled();
  const playerDebugLogMenu = usePlayerDebugLogMenuEnabled();
  const playbackFailureAutoSkipLimit = usePlaybackFailureAutoSkipLimit();
  const showPlayerDebugLogSetting = host.kind === "ios-capacitor";
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/settings"));

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
          <PageCloseButton
            edge="start"
            tooltip={t("common.backToSettings")}
            aria-label={t("common.backToSettings")}
            onClick={() => navigate("/settings")}
          />
          <SettingsAppBarTitle>
            {t("settings.userExperience")}
          </SettingsAppBarTitle>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {/* <SettingsPageDescription> Keep this here so we can use it in the future. </SettingsPageDescription> */}

        <Stack spacing={3}>
          <SettingsPreferenceSection
            title={t("settings.ux.section.appearance")}
          >
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
          </SettingsPreferenceSection>

          <SettingsPreferenceSection title={t("settings.ux.section.playback")}>
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("settings.ux.playerBarSwipe")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.playerBarSwipe.caption")}
                  </SettingsListItemCaption>
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
                  <SettingsListItemTitle>
                    {t("settings.ux.waveform")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.waveform.caption")}
                  </SettingsListItemCaption>
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
              <Box sx={{ px: 2, py: 1.5 }}>
                <SettingsListItemTitle>
                  {t("settings.ux.playbackFailureAutoSkipLimit")}
                </SettingsListItemTitle>
                <SettingsListItemCaption>
                  {t("settings.ux.playbackFailureAutoSkipLimit.caption")}
                </SettingsListItemCaption>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mt: 1.25,
                  }}
                >
                  <Slider
                    value={playbackFailureAutoSkipLimit}
                    onChange={(_, v) =>
                      setPlaybackFailureAutoSkipLimit(
                        Array.isArray(v) ? v[0]! : v,
                      )
                    }
                    min={PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MIN}
                    max={PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MAX}
                    step={1}
                    valueLabelDisplay="off"
                    aria-label={t("settings.ux.playbackFailureAutoSkipLimit")}
                    sx={{ flex: 1 }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      minWidth: 24,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {playbackFailureAutoSkipLimit}
                  </Typography>
                </Box>
              </Box>
            </SettingsPreferenceListItem>
            <Divider component="li" />
            <SettingsPreferenceListItem>
              <SettingsPreferenceRow align="center">
                <SettingsListItemTitle sx={{ flex: 1 }}>
                  {t("settings.ux.haptics")}
                </SettingsListItemTitle>
                <Switch
                  checked={hapticEnabled}
                  onChange={(_, c) => setHapticFeedbackEnabled(c)}
                  aria-label={t("settings.ux.haptics")}
                  sx={{ flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
          </SettingsPreferenceSection>

          {showPlayerDebugLogSetting ? (
            <SettingsPreferenceSection
              title={t("settings.ux.section.developer")}
            >
              <SettingsPreferenceListItem>
                <SettingsPreferenceRow>
                  <SettingsPreferenceRowLabel>
                    <SettingsListItemTitle>
                      {t("settings.ux.playerDebugLog")}
                    </SettingsListItemTitle>
                    <SettingsListItemCaption>
                      {t("settings.ux.playerDebugLog.caption")}
                    </SettingsListItemCaption>
                  </SettingsPreferenceRowLabel>
                  <Switch
                    checked={playerDebugLogMenu}
                    onChange={(_, c) => setPlayerDebugLogMenuEnabled(c)}
                    aria-label={t("settings.ux.playerDebugLog")}
                    sx={{ mt: 0.125, flexShrink: 0 }}
                  />
                </SettingsPreferenceRow>
              </SettingsPreferenceListItem>
            </SettingsPreferenceSection>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
