import { Typography } from '@mui/material';
import { useT } from '@asmusic/i18n';

export function PlaylistListViewStatus({
  initialReady,
  rowCount,
  filteredCount,
  queryTrimmed,
}: {
  initialReady: boolean;
  rowCount: number;
  filteredCount: number;
  queryTrimmed: string;
}) {
  const t = useT();

  if (!initialReady) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('library.cache.loading')}
      </Typography>
    );
  }

  if (rowCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('library.playlist.empty')}
      </Typography>
    );
  }

  if (rowCount > 0 && filteredCount === 0 && queryTrimmed.length > 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('library.playlist.noMatch')}
      </Typography>
    );
  }

  return null;
}
