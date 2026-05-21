import type { ReactNode } from "react";
import { ListItemText } from "@mui/material";
import { textSlotProps } from "./constants";

export function SongItemText({
  title,
  secondary,
  noWrapSecondary,
}: {
  title: string;
  secondary: ReactNode;
  noWrapSecondary: boolean;
}) {
  return (
    <ListItemText
      primary={title}
      secondary={secondary}
      sx={{ flex: 1, minWidth: 0, my: 0 }}
      slotProps={{
        ...textSlotProps,
        secondary: { ...textSlotProps.secondary, noWrap: noWrapSecondary },
      }}
    />
  );
}
