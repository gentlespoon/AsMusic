import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import type { ReactNode } from "react";
import { SettingsSectionHeader } from "./SettingsTypography";

const preferencePaperSx = {
  borderRadius: 2,
  overflow: "hidden",
  bgcolor: "background.paper",
} as const;

export function SettingsPreferenceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <SettingsSectionHeader sx={{ mb: 1 }}>{title}</SettingsSectionHeader>
      <Paper variant="outlined" sx={preferencePaperSx}>
        <List disablePadding>{children}</List>
      </Paper>
    </Box>
  );
}
