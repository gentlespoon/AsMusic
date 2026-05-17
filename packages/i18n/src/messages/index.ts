import type { AppLocale } from "../locale";
import { enUSMessages, type MessageKey } from "./en-US";
import { zhCNMessages } from "./zh-CN";
import { zhTWMessages } from "./zh-TW";
import { jaJPMessages } from "./ja-JP";
import { esESMessages } from "./es-ES";

export type { MessageKey };

const catalogs: Record<AppLocale, Record<MessageKey, string>> = {
  "en-US": { ...enUSMessages },
  "zh-CN": { ...zhCNMessages },
  "zh-TW": { ...zhTWMessages },
  "ja-JP": { ...jaJPMessages },
  "es-ES": { ...esESMessages },
};

export function getMessageCatalog(
  locale: AppLocale,
): Record<MessageKey, string> {
  return catalogs[locale];
}

const LOCALE_AUTONYM_KEY = "settings.ux.language.currentLanguageAutonym" satisfies MessageKey;

/** This locale's name in its own language (for language pickers). */
export function localeAutonym(locale: AppLocale): string {
  return getMessageCatalog(locale)[LOCALE_AUTONYM_KEY];
}
