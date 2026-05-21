import type { ReactNode } from "react";
import { Box, ListItem, ListItemButton } from "@mui/material";
import { rowSx } from "./constants";

export function SongItemRow({
  main,
  actions,
  onClick,
  hasActions,
}: {
  main: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  hasActions: boolean;
}) {
  if (!hasActions) {
    if (onClick) {
      return (
        <ListItemButton divider onClick={onClick} sx={rowSx}>
          {main}
        </ListItemButton>
      );
    }
    return (
      <ListItem divider disablePadding sx={rowSx}>
        {main}
      </ListItem>
    );
  }

  const mainFlexSx = { flex: 1, minWidth: 0, ...rowSx } as const;

  return (
    <ListItem
      divider
      disablePadding
      sx={{ alignItems: hasActions ? "center" : "flex-start" }}
    >
      {onClick ? (
        <ListItemButton onClick={onClick} sx={mainFlexSx}>
          {main}
        </ListItemButton>
      ) : (
        <Box sx={{ ...mainFlexSx, display: "flex" }}>{main}</Box>
      )}
      {actions}
    </ListItem>
  );
}
