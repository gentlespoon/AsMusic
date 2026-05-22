import { useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useBlackBackgroundEnabled } from './preferences/blackBackgroundPreference';
import { useAppPaletteMode } from './preferences/useAppPaletteMode';
import { createAppTheme } from './theme';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const paletteMode = useAppPaletteMode();
  const blackBackground = useBlackBackgroundEnabled();
  const theme = useMemo(
    () => createAppTheme(paletteMode, blackBackground),
    [paletteMode, blackBackground],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
