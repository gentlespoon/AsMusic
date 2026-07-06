import type { ReactNode } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import LibraryMusic from '@mui/icons-material/LibraryMusic';
import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import { useLibraryBrowseCache, useServerAndLibrary } from '@ui/contexts';
import { useOnboardingCompleted } from '@ui/preferences/onboardingCompleted';
import type { MessageKey } from '@asmusic/i18n';

function emptyMessageKey(serversCount: number, onboardingCompleted: boolean): MessageKey {
  if (!onboardingCompleted) return 'library.activeScope.emptyNeedLibrary';
  if (serversCount === 0) return 'library.activeScope.emptyNeedServer';
  return 'library.activeScope.emptyNoLibraries';
}

/** Renders children when at least one library scope is active; otherwise shows setup guidance. */
export function ActiveScopeGate({ children }: { children: ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const onboardingCompleted = useOnboardingCompleted();
  const { servers } = useServerAndLibrary();
  const { scopesToLoad } = useLibraryBrowseCache();

  if (scopesToLoad.length > 0) {
    return <>{children}</>;
  }

  return (
    <Box component="section" aria-label={t('library.album.ariaSection')} sx={{ pt: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t(emptyMessageKey(servers.length, onboardingCompleted))}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {!onboardingCompleted && (
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/onboarding')}
            aria-label={t('library.activeScope.openSetupGuide')}
          >
            {t('library.activeScope.getStarted')}
          </Button>
        )}
        <Tooltip title={t('library.activeScope.serversLibraries')}>
          <IconButton
            size="small"
            color="primary"
            aria-label={t('library.activeScope.openServersLibraries')}
            onClick={() => navigate('/settings/servers-libraries?tab=libraries')}
          >
            <LibraryMusic />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
