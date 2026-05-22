import { createTheme, type PaletteMode } from '@mui/material/styles';

const PRIMARY_MAIN = '#3d6fd4';

const darkPalette = {
  mode: 'dark' as const,
  primary: { main: PRIMARY_MAIN },
  background: {
    default: '#0f1115',
    paper: '#14171d',
  },
  divider: '#2a3140',
  text: {
    primary: '#e8eaed',
    secondary: '#8b95a8',
  },
};

const darkBlackPalette = {
  ...darkPalette,
  background: {
    default: '#000000',
    paper: '#0a0a0a',
  },
};

const lightPalette = {
  mode: 'light' as const,
  primary: { main: PRIMARY_MAIN },
  background: {
    default: '#f4f6f9',
    paper: '#ffffff',
  },
  divider: '#e0e4eb',
  text: {
    primary: '#1a1d24',
    secondary: '#5c6578',
  },
};

export function createAppTheme(mode: PaletteMode, blackBackground = false) {
  const palette =
    mode === 'dark' ? (blackBackground ? darkBlackPalette : darkPalette) : lightPalette;

  return createTheme({
    palette,
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'].join(','),
    },
    components: {
      MuiAppBar: {
        defaultProps: {
          color: 'transparent',
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            colorScheme: mode,
          },
          body: {
            WebkitFontSmoothing: 'antialiased',
          },
          '*, *::before, *::after': {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          },
          'input, textarea, [contenteditable="true"]': {
            userSelect: 'text',
            WebkitUserSelect: 'text',
          },
        },
      },
    },
  });
}

/** Default dark theme; prefer `AppThemeProvider` + `createAppTheme` for hosts that follow system appearance. */
export const appTheme = createAppTheme('dark');
