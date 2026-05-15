/** BCP 47 locales shipped with the app. Add catalogs before expanding this union. */
export type AppLocale = 'en-US' | 'zh-CN' | 'zh-TW' | 'ja-JP' | 'es-ES';

export const DEFAULT_LOCALE: AppLocale = 'en-US';

export const SUPPORTED_LOCALES: readonly AppLocale[] = [
  'en-US',
  'zh-CN',
  'zh-TW',
  'ja-JP',
  'es-ES',
];

function normalizeLanguageTag(tag: string): string {
  const parts = tag.trim().split(/[-_]/);
  if (parts.length === 0 || !parts[0]) return DEFAULT_LOCALE;
  const language = parts[0].toLowerCase();
  const region = parts[1]?.toUpperCase();
  return region ? `${language}-${region}` : language;
}

const TRADITIONAL_CHINESE_REGIONS = new Set(['TW', 'HK', 'MO', 'HANT']);

function tagToAppLocale(tag: string): AppLocale | null {
  const normalized = normalizeLanguageTag(tag);
  if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as AppLocale;
  }
  const [language, region] = normalized.split('-');
  if (language === 'en') return 'en-US';
  if (language === 'zh') {
    if (region && TRADITIONAL_CHINESE_REGIONS.has(region)) return 'zh-TW';
    return 'zh-CN';
  }
  if (language === 'ja') return 'ja-JP';
  if (language === 'es') return 'es-ES';
  return null;
}

/**
 * Resolve the best app locale from a BCP 47 tag (device, Electron, or test override).
 * Falls back to {@link DEFAULT_LOCALE} when no catalog exists yet.
 */
export function resolveAppLocale(preferred?: string | null): AppLocale {
  if (preferred) {
    const resolved = tagToAppLocale(preferred);
    if (resolved) return resolved;
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    const resolved = tagToAppLocale(navigator.language);
    if (resolved) return resolved;
  }

  return DEFAULT_LOCALE;
}

/** Intl / DOM language tag for the given app locale. */
export function intlLocaleTag(locale: AppLocale): string {
  return locale;
}
