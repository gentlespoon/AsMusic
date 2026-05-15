import type { AppLocale } from './locale';
import { getMessageCatalog, type MessageKey } from './messages';

export type TranslateParams = Record<string, string | number>;

function interpolate(template: string, params: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: TranslateParams
): string {
  const template = getMessageCatalog(locale)[key];
  return params ? interpolate(template, params) : template;
}
