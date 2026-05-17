import { I18nProvider, type AppLocale } from '@asmusic/i18n';
import type { ReactNode } from 'react';
import {
  useDisplayLanguagePreference,
  type DisplayLanguagePreference,
} from './preferences/displayLanguagePreference';

function pinnedLocale(preference: DisplayLanguagePreference): AppLocale | undefined {
  return preference === 'system' ? undefined : preference;
}

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const preference = useDisplayLanguagePreference();
  return <I18nProvider locale={pinnedLocale(preference)}>{children}</I18nProvider>;
}
