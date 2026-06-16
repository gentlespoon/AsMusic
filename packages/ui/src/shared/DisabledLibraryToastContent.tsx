import { Stack, Typography } from "@mui/material";
import { useT } from "@asmusic/i18n";

type DisabledLibraryToastTitleKey =
  | "library.playlist.enableLibraryToPlay"
  | "player.playback.skippedLibraryDisabledTitle";

export function DisabledLibraryToastContent({
  serverName,
  libraryName,
  titleKey = "library.playlist.enableLibraryToPlay",
}: {
  serverName: string;
  libraryName: string;
  titleKey?: DisabledLibraryToastTitleKey;
}) {
  const t = useT();
  return (
    <Stack spacing={0.25} sx={{ py: 0.5, alignItems: "center" }}>
      <Typography variant="body2">{t(titleKey)}</Typography>
      <Typography variant="body2" color="text.secondary">
        {serverName}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {libraryName}
      </Typography>
    </Stack>
  );
}
