import { useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useBlackBackgroundEnabled } from './preferences/blackBackgroundPreference';
import { useTextSelectionEnabled } from './preferences/textSelectionPreference';
import { useAppPaletteMode } from './preferences/useAppPaletteMode';
import { createAppTheme } from './theme';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const paletteMode = useAppPaletteMode();
  const blackBackground = useBlackBackgroundEnabled();
  const textSelectionEnabled = useTextSelectionEnabled();
  const theme = useMemo(
    () => createAppTheme(paletteMode, blackBackground, textSelectionEnabled),
    [paletteMode, blackBackground, textSelectionEnabled],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
