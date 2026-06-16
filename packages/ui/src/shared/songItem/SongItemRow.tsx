import type { ReactNode } from "react";
import { Box, ListItem, ListItemButton } from "@mui/material";
import { rowSx } from "./constants";

export function SongItemRow({
  main,
  actions,
  onClick,
  hasActions,
  unavailable = false,
}: {
  main: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  hasActions: boolean;
  unavailable?: boolean;
}) {
  const rowStyle = unavailable ? { opacity: 0.55, color: 'text.secondary' } : undefined;
  if (!hasActions) {
    if (onClick) {
      return (
        <ListItemButton divider onClick={onClick} sx={{ ...rowSx, ...rowStyle }}>
          {main}
        </ListItemButton>
      );
    }
    return (
      <ListItem divider disablePadding sx={{ ...rowSx, ...rowStyle }}>
        {main}
      </ListItem>
    );
  }

  const mainFlexSx = { flex: 1, minWidth: 0, ...rowSx } as const;

  return (
    <ListItem
      divider
      disablePadding
      sx={{ alignItems: hasActions ? "center" : "flex-start", ...rowStyle }}
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
