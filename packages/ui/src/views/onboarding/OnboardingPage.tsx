import { useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import { useServerAndLibrary } from '@ui/contexts';
import { LibrarySelectorView } from '@ui/views/servers/librarySelector';
import { ServerManagerView } from '@ui/views/servers/ServerManagerView';
import { playerDockPaddingBottomSx } from '@ui/player/core/constants';
import { setOnboardingCompleted } from '@ui/preferences/onboardingCompleted';

type Step = 'welcome' | 'addServer' | 'activateLibrary';

function finishAndGoHome(navigate: ReturnType<typeof useNavigate>) {
  setOnboardingCompleted(true);
  navigate('/', { replace: true });
}

export function OnboardingPage() {
  const t = useT();
  const navigate = useNavigate();
  const { servers, activeLibraryRefs } = useServerAndLibrary();
  const [step, setStep] = useState<Step>('welcome');
  const prevStepRef = useRef<Step>(step);
  const serverBaselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (step === 'addServer' && prevStepRef.current !== 'addServer') {
      serverBaselineRef.current = servers.length;
    }
    prevStepRef.current = step;
  }, [step, servers.length]);

  useEffect(() => {
    if (step !== 'addServer') return;
    const baseline = serverBaselineRef.current;
    if (baseline == null) return;
    if (servers.length > baseline) {
      setStep('activateLibrary');
    }
  }, [step, servers.length]);

  const goBack = () => {
    if (step === 'addServer') setStep('welcome');
    else if (step === 'activateLibrary') setStep('addServer');
  };

  const goNext = () => {
    if (step === 'welcome') setStep('addServer');
    else if (step === 'addServer' && servers.length > 0) setStep('activateLibrary');
  };

  const done = () => {
    if (activeLibraryRefs.length < 1) return;
    finishAndGoHome(navigate);
  };

  const nextDisabled =
    step === 'addServer' ? servers.length < 1 : step === 'activateLibrary';

  const stepTitle =
    step === 'welcome'
      ? t('onboarding.step.welcome')
      : step === 'addServer'
        ? t('onboarding.step.addServer')
        : t('onboarding.step.activateLibrary');

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky">
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          {step !== 'welcome' ? (
            <IconButton edge="start" color="inherit" aria-label={t('common.back')} onClick={goBack} size="small">
              <ArrowBack />
            </IconButton>
          ) : (
            <Box sx={{ width: 40 }} />
          )}
          <Typography variant="subtitle1" component="h1" sx={{ flex: 1, fontWeight: 600, textAlign: 'center' }}>
            {stepTitle}
          </Typography>
          <Box sx={{ flexShrink: 0, minWidth: 72, display: 'flex', justifyContent: 'flex-end' }}>
            {step === 'activateLibrary' ? (
              <Button
                variant="contained"
                size="small"
                disabled={activeLibraryRefs.length < 1}
                onClick={done}
                aria-label={
                  activeLibraryRefs.length < 1
                    ? t('onboarding.finishDisabled')
                    : t('onboarding.finishSetup')
                }
              >
                {t('common.finish')}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                disabled={nextDisabled}
                onClick={goNext}
                aria-label={
                  step === 'addServer' && servers.length < 1
                    ? t('common.nextAddServerFirst')
                    : t('common.next')
                }
              >
                {t('common.next')}
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3, flex: 1 }}>
        {step === 'welcome' && (
          <Stack spacing={2}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              {t('onboarding.welcome.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('onboarding.welcome.body')}
            </Typography>
          </Stack>
        )}

        {step === 'addServer' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('onboarding.addServer.body')}
            </Typography>
            <ServerManagerView embedded />
          </Stack>
        )}

        {step === 'activateLibrary' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('onboarding.activateLibrary.body')}
            </Typography>
            <LibrarySelectorView embedded />
          </Stack>
        )}
      </Container>
    </Box>
  );
}
