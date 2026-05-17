import { useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppAppearanceMode } from './preferences/appearanceMode';
import { createAppTheme } from './theme';

function defaultPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const appearanceMode = useAppAppearanceMode();
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', {
    defaultMatches: defaultPrefersDark(),
  });
  const paletteMode =
    appearanceMode === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : appearanceMode;
  const theme = useMemo(() => createAppTheme(paletteMode), [paletteMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
