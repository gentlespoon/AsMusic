import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

/** Row header below library drill-down (back + title + optional actions). */
export const libraryDetailHeaderStackSx: SxProps<Theme> = {
  flexShrink: 0,
  mb: 2,
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 1,
};

/** Primary title on album/artist/playlist detail screens. */
export function LibraryDetailTitle({ sx, ...props }: TypographyProps) {
  return (
    <Typography
      variant="h6"
      component="h2"
      sx={{ fontWeight: 600, flex: 1, minWidth: 0, ...sx }}
      {...props}
    />
  );
}

/** Album name on grid card artwork tiles. */
export function LibraryAlbumCardTitle({ sx, ...props }: TypographyProps) {
  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 1.25,
        ...sx,
      }}
      {...props}
    />
  );
}

/** Artist / track count line under album name on grid cards. */
export function LibraryAlbumCardCaption({ sx, ...props }: TypographyProps) {
  return (
    <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.25, display: 'block', ...sx }} {...props} />
  );
}
