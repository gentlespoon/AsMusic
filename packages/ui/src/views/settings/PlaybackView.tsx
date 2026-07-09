import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import { Divider, List, Paper, Stack, Switch } from "@mui/material";
import { useOfflineDownload } from "@ui/contexts/OfflineDownloadContext";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import {
  setHapticFeedbackEnabled,
  useHapticFeedbackEnabled,
} from "@ui/preferences/hapticFeedbackPreference";
import {
  setWaveformProgressBarEnabled,
  useWaveformProgressBarEnabled,
} from "@ui/preferences/waveformProgressBarPreference";
import {
  setMiniPlayerSwipeGesturesEnabled,
  useMiniPlayerSwipeGesturesEnabled,
} from "@ui/player/miniBar/miniPlayerPreferences";
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

export function PlaybackView() {
  const t = useT();
  const navigate = useNavigate();
  const miniBarSwipeGestures = useMiniPlayerSwipeGesturesEnabled();
  const hapticEnabled = useHapticFeedbackEnabled();
  const waveformProgressBar = useWaveformProgressBarEnabled();
  const { persistWhileStreaming, setPersistWhileStreaming } =
    useOfflineDownload();
  const edgeSwipeBack = useEdgeSwipeBack(() => navigate("/settings"));

  return (
    <SettingsPageLayout
      title={t("settings.playback")}
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
                    {t("settings.ux.persistWhileStreaming")}
                  </SettingsListItemTitle>
                  <SettingsListItemCaption>
                    {t("settings.ux.persistWhileStreaming.caption")}
                  </SettingsListItemCaption>
                </SettingsPreferenceRowLabel>
                <Switch
                  checked={persistWhileStreaming}
                  onChange={(_, c) => void setPersistWhileStreaming(c)}
                  aria-label={t("settings.ux.persistWhileStreaming")}
                  sx={{ mt: 0.125, flexShrink: 0 }}
                />
              </SettingsPreferenceRow>
            </SettingsPreferenceListItem>
            <Divider component="li" />
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
          </List>
        </Paper>
      </Stack>
    </SettingsPageLayout>
  );
}
