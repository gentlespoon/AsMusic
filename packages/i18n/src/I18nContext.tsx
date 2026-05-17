import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createFormatters, type I18nFormatters } from './format';
import { DEFAULT_LOCALE, resolveAppLocale, type AppLocale } from './locale';
import type { MessageKey } from './messages';
import { translate, type TranslateParams } from './translate';

export type I18nContextValue = {
  locale: AppLocale;
  /** Replace when adding user-facing locale switching. */
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  format: I18nFormatters;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export type I18nProviderProps = {
  children: ReactNode;
  /**
   * Pin locale (tests, Electron main → renderer). When omitted, uses
   * `navigator.language` in browser / Capacitor WebView with catalog fallback.
   */
  locale?: AppLocale;
};

export function I18nProvider({ children, locale: localeProp }: I18nProviderProps) {
  const [locale, setLocale] = useState<AppLocale>(
    () => localeProp ?? resolveAppLocale()
  );

  useEffect(() => {
    setLocale(localeProp ?? resolveAppLocale());
  }, [localeProp]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (localeProp != null || typeof window === 'undefined') return;
    const onLanguageChange = () => setLocale(resolveAppLocale());
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, [localeProp]);

  const format = useMemo(() => createFormatters(locale), [locale]);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, format }),
    [locale, t, format]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

/** Shorthand for `useI18n().t`. */
export function useT(): I18nContextValue['t'] {
  return useI18n().t;
}

export { DEFAULT_LOCALE, resolveAppLocale, type AppLocale };
