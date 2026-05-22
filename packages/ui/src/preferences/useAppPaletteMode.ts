import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppAppearanceMode } from './appearanceMode';
import type { PaletteMode } from '@mui/material/styles';

function defaultPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolved light/dark palette mode from appearance setting and system preference. */
export function useAppPaletteMode(): PaletteMode {
  const appearanceMode = useAppAppearanceMode();
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', {
    defaultMatches: defaultPrefersDark(),
  });
  return appearanceMode === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : appearanceMode;
}
