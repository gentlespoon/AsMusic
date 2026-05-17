import { intlLocaleTag, type AppLocale } from './locale';

export type CountWords = {
  one: string;
  other: string;
};

export function formatNumber(locale: AppLocale, value: number): string {
  return value.toLocaleString(intlLocaleTag(locale));
}

/** English-style count label, e.g. "1 track" / "12 tracks". */
export function formatCount(locale: AppLocale, count: number, words: CountWords): string {
  const n = formatNumber(locale, count);
  const word = count === 1 ? words.one : words.other;
  return `${n} ${word}`;
}

export function formatDateTime(
  locale: AppLocale,
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), options).format(date);
}

export type I18nFormatters = {
  number: (value: number) => string;
  count: (count: number, words: CountWords) => string;
  dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
};

export function createFormatters(locale: AppLocale): I18nFormatters {
  return {
    number: (value) => formatNumber(locale, value),
    count: (count, words) => formatCount(locale, count, words),
    dateTime: (date, options) => formatDateTime(locale, date, options),
  };
}
