import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { appAssetUrl } from '../../app/appBasePath';
import { getAppBuildLabel } from '../../app/appBuildInfo';
import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import BugReportOutlined from '@mui/icons-material/BugReportOutlined';
import ChevronRight from '@mui/icons-material/ChevronRight';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import MusicNote from '@mui/icons-material/MusicNote';
import {
  AppBar,
  Box,
  Container,
  Divider,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { PageCloseButton } from '../../shared/PageCloseButton';
import { useHost } from '../../host/HostContext';
import { playerDockPaddingBottomSx } from '../../player/core/constants';

const FEEDBACK_EMAIL = 'support@angdasoft.com';
const REPOSITORY_URL = 'https://github.com/gentlespoon/asmusic';
const ISSUES_URL = 'https://github.com/gentlespoon/asmusic/issues';

function useAppBuildLabel(): string {
  const [label, setLabel] = useState('—');

  useEffect(() => {
    let cancelled = false;
    void getAppBuildLabel().then((value) => {
      if (!cancelled) setLabel(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return label;
}

function AboutSectionHeader({ children }: { children: string }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ display: 'block', px: 0.5, mb: 0.75, letterSpacing: '0.08em' }}
    >
      {children}
    </Typography>
  );
}

function AboutLabeledRow({ label, value }: { label: string; value: string }) {
  return (
    <ListItem
      sx={{
        py: 1.25,
        px: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
        {value}
      </Typography>
    </ListItem>
  );
}

export function AboutView() {
  const t = useT();
  const navigate = useNavigate();
  const host = useHost();
  const buildLabel = useAppBuildLabel();
  const [appIconFailed, setAppIconFailed] = useState(false);
  const feedbackMailHref = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t('about.feedbackEmailSubject'))}`;
  const shellLabel =
    host.kind === 'ios-capacitor'
      ? t('about.shellIos', { platform: Capacitor.getPlatform() })
      : t('about.shellBrowser');

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
        bgcolor: 'background.default',
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky">
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton edge="start" onClick={() => navigate('/')} />
          <Typography variant="subtitle1" component="h1" sx={{ flex: 1, fontWeight: 600 }}>
            {t('about.title')}
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={1.75} sx={{ mb: 3, textAlign: 'center', alignItems: 'center' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {appIconFailed ? (
              <MusicNote sx={{ fontSize: 44, color: 'primary.main' }} aria-hidden />
            ) : (
              <Box
                component="img"
                src={appAssetUrl('icon/icon.png')}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setAppIconFailed(true)}
              />
            )}
          </Box>

          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            AsMusic
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            {t('about.subtitle')}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {t('about.copyright')}
          </Typography>
        </Stack>

        <AboutSectionHeader>{t('about.section.version')}</AboutSectionHeader>
        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', mb: 2.5 }}
        >
          <List disablePadding>
            <AboutLabeledRow label={t('about.build')} value={buildLabel} />
            <Divider component="li" />
            <AboutLabeledRow label={t('about.shell')} value={shellLabel} />
            <Divider component="li" />
            <AboutLabeledRow label={t('about.host')} value={host.kind} />
          </List>
        </Paper>

        <AboutSectionHeader>{t('about.section.support')}</AboutSectionHeader>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
          <List disablePadding>
            <ListItemButton component="a" href={feedbackMailHref} sx={{ py: 1.5, px: 2 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <EmailOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={t('about.sendFeedback')}
                slotProps={{ primary: { variant: 'body1', sx: { fontWeight: 500 } } }}
              />
              <ChevronRight sx={{ color: 'action.active', flexShrink: 0 }} fontSize="small" />
            </ListItemButton>
            <Divider component="li" />
            <ListItemButton
              component={Link}
              href={ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              color="inherit"
              sx={{ py: 1.5, px: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <BugReportOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={t('about.reportIssue')}
                slotProps={{ primary: { variant: 'body1', sx: { fontWeight: 500 } } }}
              />
              <ChevronRight sx={{ color: 'action.active', flexShrink: 0 }} fontSize="small" />
            </ListItemButton>
            <Divider component="li" />
            <ListItemButton
              component={Link}
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              color="inherit"
              sx={{ py: 1.5, px: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <CodeOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={t('about.repository')}
                slotProps={{ primary: { variant: 'body1', sx: { fontWeight: 500 } } }}
              />
              <ChevronRight sx={{ color: 'action.active', flexShrink: 0 }} fontSize="small" />
            </ListItemButton>
          </List>
        </Paper>
      </Container>
    </Box>
  );
}
