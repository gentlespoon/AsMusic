import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Divider,
  List,
  Paper,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useHost } from "@ui/host/HostContext";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import {
  PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MAX,
  PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MIN,
  setPlaybackFailureAutoSkipLimit,
  usePlaybackFailureAutoSkipLimit,
} from "@ui/preferences/playbackFailureAutoSkipLimitPreference";
import {
  setPlayerDebugLogMenuEnabled,
  usePlayerDebugLogMenuEnabled,
} from "@ui/preferences/playerDebugLogPreference";
import {
  setTextSelectionEnabled,
  useTextSelectionEnabled,
} from "@ui/preferences/textSelectionPreference";
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

export function DeveloperView() {
  const t = useT();
  const host = useHost();
  const navigate = useNavigate();
  const playerDebugLogMenu = usePlayerDebugLogMenuEnabled();
  const textSelectionEnabled = useTextSelectionEnabled();
  const playbackFailureAutoSkipLimit = usePlaybackFailureAutoSkipLimit();
  const showPlayerDebugLogSetting = host.kind === "ios-capacitor";
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/settings"));

  return (
    <SettingsPageLayout
      title={t("settings.developer")}
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
              <SettingsPreferenceRow>
                <SettingsPreferenceRowLabel>
                  <SettingsListItemTitle>
                    {t("settings.ux.textSelection")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.textSelection.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={textSelectionEnabled}
                  onChange={(_, c) => setTextSelectionEnabled(c)}
                  aria-label={t("settings.ux.textSelection")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            {showPlayerDebugLogSetting ? (
              <>
                <Divider component="li" />
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
              </>
            ) : null}
          </List>
        </Paper>
      </Stack>
    </SettingsPageLayout>
  );
}
