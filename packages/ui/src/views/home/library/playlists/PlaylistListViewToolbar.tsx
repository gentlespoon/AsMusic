import { IconButton, Stack, TextField, Tooltip } from '@mui/material';
import Add from '@mui/icons-material/Add';
import { useT } from '@asmusic/i18n';

export function PlaylistListViewToolbar({
  search,
  onSearchChange,
  onCreateClick,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateClick: () => void;
}) {
  const t = useT();

  return (
    <Stack direction="row" spacing={1} sx={{ flexShrink: 0, mb: 2, alignItems: 'center' }}>
      <TextField
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('library.playlist.search')}
        aria-label={t('library.playlist.filter')}
        fullWidth
        size="small"
      />
      <Tooltip title={t('library.playlist.create')}>
        <IconButton
          color="primary"
          aria-label={t('library.playlist.create')}
          onClick={onCreateClick}
        >
          <Add />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
