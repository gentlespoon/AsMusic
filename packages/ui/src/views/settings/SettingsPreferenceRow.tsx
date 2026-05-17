import Box, { type BoxProps } from "@mui/material/Box";
import ListItem, { type ListItemProps } from "@mui/material/ListItem";

/** List item shell for a preference row inside a settings card. */
export function SettingsPreferenceListItem({
  children,
  ...props
}: ListItemProps) {
  return (
    <ListItem disablePadding sx={{ display: "block" }} {...props}>
      {children}
    </ListItem>
  );
}

type SettingsPreferenceRowProps = BoxProps & {
  align?: "flex-start" | "center";
};

/** Horizontal layout for label + control inside a preference row. */
export function SettingsPreferenceRow({
  align = "flex-start",
  sx,
  ...props
}: SettingsPreferenceRowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: align,
        gap: 1.5,
        px: 2,
        py: 1.5,
        ...sx,
      }}
      {...props}
    />
  );
}

/** Title and caption column that grows and truncates correctly. */
export function SettingsPreferenceRowLabel({ sx, ...props }: BoxProps) {
  return <Box sx={{ flex: 1, minWidth: 0, ...sx }} {...props} />;
}
