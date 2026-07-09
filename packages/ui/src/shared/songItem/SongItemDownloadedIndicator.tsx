import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { Box } from "@mui/material";
import type { useT } from "@asmusic/i18n";

const INDICATOR_SIZE = 22;

export function SongItemDownloadedIndicator({
  isDownloaded,
  t,
}: {
  isDownloaded: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <Box
      sx={{
        width: INDICATOR_SIZE,
        height: INDICATOR_SIZE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        alignSelf: "center",
        mr: 0.25,
      }}
      aria-hidden={!isDownloaded}
    >
      {isDownloaded ? (
        <CheckCircleRounded
          sx={{ fontSize: 16 }}
          color="success"
          aria-label={t("offline.downloading.trackState.completed")}
        />
      ) : null}
    </Box>
  );
}
