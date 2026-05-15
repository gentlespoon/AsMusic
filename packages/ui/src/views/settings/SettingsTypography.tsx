import Typography, { type TypographyProps } from "@mui/material/Typography";

/** App bar title on settings screens (subtitle1, semibold). */
export function SettingsAppBarTitle({ children, ...props }: TypographyProps) {
  return (
    <Typography
      variant="subtitle1"
      component="h1"
      sx={{ flex: 1, fontWeight: 600 }}
      {...props}
    >
      {children}
    </Typography>
  );
}

/** Lead paragraph below the app bar on settings screens. */
export function SettingsPageDescription({ sx, ...props }: TypographyProps) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mb: 2, ...sx }}
      {...props}
    />
  );
}

/** In-page section heading (e.g. “Saved servers”, “New server”). */
export function SettingsSectionHeader({ sx, ...props }: TypographyProps) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, ...sx }} {...props} />
  );
}

type SettingsListItemTitleProps = TypographyProps & {
  /** Navigation row in a chevron list (body1) vs preference row in a card (body2). */
  kind?: "nav" | "row";
};

/** Primary label for a settings list row. */
export function SettingsListItemTitle({
  kind = "row",
  sx,
  ...props
}: SettingsListItemTitleProps) {
  return (
    <Typography
      variant={kind === "nav" ? "body1" : "body2"}
      sx={
        kind === "nav"
          ? { fontWeight: 500, ...sx }
          : { fontWeight: 500, lineHeight: 1.3, ...sx }
      }
      {...props}
    />
  );
}

/** Secondary description under a settings list row title. */
export function SettingsListItemCaption({ sx, ...props }: TypographyProps) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 0.5, lineHeight: 1.35, ...sx }}
      {...props}
    />
  );
}
