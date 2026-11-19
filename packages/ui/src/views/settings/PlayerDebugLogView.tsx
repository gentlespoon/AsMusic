import { useCallback, useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import { Navigate, useNavigate } from "react-router-dom";
import { Box, Button, TextField } from "@mui/material";
import { useHost } from "@ui/host/HostContext";
import { useEdgeSwipeBack } from "@ui/shared/useEdgeSwipeBack";
import {
  copyPlayerDebugLogToClipboard,
  exportPlayerDebugLog,
} from "@ui/player/core/playerDebugLog";
import { usePlayerDebugLogMenuEnabled } from "@ui/preferences/playerDebugLogPreference";
import { SettingsPageLayout } from "./SettingsPageLayout";

export const PLAYER_DEBUG_LOG_PATH = "/settings/player-debug-log";

export function PlayerDebugLogView() {
  const t = useT();
  const host = useHost();
  const navigate = useNavigate();
  const menuEnabled = usePlayerDebugLogMenuEnabled();
  const [logText, setLogText] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const edgeSwipeBack = useEdgeSwipeBack(() => navigate(-1));

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const text = await exportPlayerDebugLog(host);
      setLogText(text);
    } catch {
      setLogText("");
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  if (host.kind !== "ios-capacitor" || !menuEnabled) {
    return <Navigate to="/settings" replace />;
  }

  const copyLabel =
    copyState === "copied"
      ? t("playerDebugLog.copied")
      : copyState === "error"
        ? t("playerDebugLog.copyFailed")
        : t("playerDebugLog.copy");

  return (
    <SettingsPageLayout
      title={t("playerDebugLog.title")}
      onClose={() => navigate(-1)}
      closeButtonProps={{
        tooltip: t("common.back"),
        "aria-label": t("common.back"),
      }}
      edgeSwipeBack={edgeSwipeBack}
      scrollBody={false}
      contentSx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        py: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 2,
        }}
      >
        <TextField
          multiline
          fullWidth
          variant="outlined"
          value={loading ? t("playerDebugLog.loading") : logText}
          slotProps={{
            input: {
              readOnly: true,
            },
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            "& .MuiInputBase-root": {
              height: "100%",
              alignItems: "flex-start",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              lineHeight: 1.45,
            },
            "& .MuiInputBase-inputMultiline": {
              height: "100% !important",
              overflow: "auto !important",
              WebkitOverflowScrolling: "touch",
            },
          }}
        />
        <Button
          variant="contained"
          fullWidth
          disabled={loading || !logText.trim()}
          onClick={() => {
            setCopyState("idle");
            void copyPlayerDebugLogToClipboard(host)
              .then((result) =>
                setCopyState(result.clipboardOk ? "copied" : "error"),
              )
              .catch(() => setCopyState("error"));
          }}
          sx={{ flexShrink: 0 }}
        >
          {copyLabel}
        </Button>
      </Box>
    </SettingsPageLayout>
  );
}