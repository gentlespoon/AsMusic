import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import { IconButton, Stack, Tooltip } from '@mui/material';
import Dns from '@mui/icons-material/Dns';

export function LibrarySelectorToolbar() {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
      <Tooltip title={t('servers.libraries.manageServers')}>
        <IconButton
          size="small"
          aria-label={t('servers.libraries.manageServers')}
          onClick={() => navigate('/settings/servers-libraries?tab=servers')}
        >
          <Dns fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
