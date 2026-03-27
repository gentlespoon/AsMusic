/**
 * Romanize artist names for alphabetical sorting. Language is chosen in Settings
 * (Chinese → Pinyin, Japanese → Romaji [kanji+kana], Korean → Romanization).
 * Latin characters are kept as-is; non-Latin are romanized per the selected language.
 */

import pinyin from 'pinyin';
import { romanize as koromanRomanize } from 'koroman';

const defaultCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  usage: 'sort',
});

/** User-selectable sort language (Settings). Used for all non-Latin romanization. */
export type SortLanguage = 'none' | 'chinese' | 'japanese' | 'korean';

/** ISO 639-3 / display lang code → display name for UI */
const LANGUAGE_NAMES: Record<string, string> = {
  cmn: 'Chinese',
  zho: 'Chinese',
  jpn: 'Japanese',
  kor: 'Korean',
  eng: 'English',
  fra: 'French',
  deu: 'German',
  spa: 'Spanish',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  und: 'Unknown',
};

export function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export type RomanizeResult = { key: string; lang: string };

/** Keep as-is: Latin script letters, digits, spaces, common name punctuation */
function isLatinChar(c: string): boolean {
  return /^[\p{Script=Latin}\p{N}\s\-'.()]$/u.test(c) || /^[a-zA-Z0-9\s\-'.()]$/.test(c);
}

/** Split string into segments of consecutive Latin vs non-Latin characters */
function splitLatinNonLatin(str: string): string[] {
  const segments: string[] = [];
  const chars = Array.from(str);
  let i = 0;
  while (i < chars.length) {
    const start = i;
    const latin = isLatinChar(chars[i]);
    while (i < chars.length && isLatinChar(chars[i]) === latin) i++;
    segments.push(chars.slice(start, i).join(''));
  }
  return segments;
}

/** Lazy-initialized kuroshiro instance for full Japanese (kanji + kana) → romaji */
let kuroshiroPromise: Promise<{ convert: (str: string, opts: { to: string }) => Promise<string> }> | null = null;
let kuroshiroInitError: unknown = null;

/**
 * Dict path for kuromoji: copy to public/kuromoji-dict via `pnpm run copy:dict` (or postinstall).
 * Must be a path the browser can fetch (no path.join with URL in kuromoji).
 */
const KUROMOJI_DICT_PATH = '/kuromoji-dict/';

async function getKuroshiro(): Promise<{ convert: (str: string, opts: { to: string }) => Promise<string> }> {
  if (kuroshiroInitError) throw kuroshiroInitError;
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const Kuroshiro = (await import('kuroshiro')).default;
      const KuromojiAnalyzer = (await import('kuroshiro-analyzer-kuromoji')).default;
      const k = new Kuroshiro();
      await k.init(new KuromojiAnalyzer({ dictPath: KUROMOJI_DICT_PATH }));
      return k;
    })().catch((err) => {
      kuroshiroInitError = err;
      console.warn(
        'Kuroshiro init failed; Japanese kanji will not be romanized. Run `pnpm run copy:dict` and reload.',
        err
      );
      throw err;
    });
  }
  return kuroshiroPromise;
}

/** Romanize a Japanese segment (kanji + kana) to romaji using kuroshiro */
async function romanizeJapaneseSegment(segment: string): Promise<string> {
  try {
    const kuroshiro = await getKuroshiro();
    const result = await kuroshiro.convert(segment, { to: 'romaji', romajiSystem: 'hepburn' });
    return typeof result === 'string' ? result : segment;
  } catch {
    return segment;
  }
}

/** Map SortLanguage to lang code for display */
function sortLanguageToCode(lang: SortLanguage): string {
  if (lang === 'chinese') return 'cmn';
  if (lang === 'japanese') return 'jpn';
  if (lang === 'korean') return 'kor';
  return 'und';
}

/** Romanize a single non-Latin character (used for Chinese and Korean; Japanese uses kuroshiro per segment) */
function romanizeSingleChar(char: string, language: SortLanguage): string {
  try {
    if (language === 'chinese') {
      const result = pinyin(char, { style: 'tone' });
      if (Array.isArray(result) && result.length > 0) {
        const first = result[0];
        const syllable = Array.isArray(first) ? first[0] : first;
        if (syllable && typeof syllable === 'string') return syllable;
      }
    }
    if (language === 'korean') {
      const out = koromanRomanize(char);
      if (out && typeof out === 'string') return out;
    }
  } catch {
    // fall through to return char
  }
  return char;
}

/**
 * Romanize name using the selected sort language. When sortLanguage is 'none',
 * returns the name as-is. For Japanese, full segments (kanji + kana) are
 * converted with kuroshiro; for Chinese/Korean, character-by-character.
 */
async function romanizeWithLang(
  name: string,
  sortLanguage: SortLanguage
): Promise<RomanizeResult> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { key: '', lang: 'und' };

  if (sortLanguage === 'none') {
    return { key: trimmed, lang: 'und' };
  }

  if (sortLanguage === 'japanese') {
    const segments = splitLatinNonLatin(trimmed);
    const converted = await Promise.all(
      segments.map((seg) =>
        isLatinChar(seg.charAt(0)) ? Promise.resolve(seg) : romanizeJapaneseSegment(seg)
      )
    );
    const key = converted.join('').trim() || trimmed;
    return { key, lang: 'jpn' };
  }

  const chars = Array.from(trimmed);
  const segments: string[] = [];
  let lastWasRomanized = false;

  for (const c of chars) {
    if (isLatinChar(c)) {
      segments.push(c);
      lastWasRomanized = false;
      continue;
    }

    try {
      const romanized = romanizeSingleChar(c, sortLanguage);
      if (romanized !== c) {
        if (lastWasRomanized) segments.push(' ');
        segments.push(romanized);
        lastWasRomanized = true;
      } else {
        segments.push(c);
        lastWasRomanized = false;
      }
    } catch {
      segments.push(c);
      lastWasRomanized = false;
    }
  }

  const key = segments.join('');
  const lang = sortLanguageToCode(sortLanguage);
  return { key: key || trimmed, lang };
}

export type SortArtistsResult<T> = {
  sorted: T[];
  keyMap: Map<string, string>;
  langMap: Map<string, string>;
};

/**
 * Sort items by romanized key using the selected sort language. When sortLanguage
 * is 'none', sorts by original key (locale); otherwise uses romanized keys.
 * Optionally builds id → romanized key and id → language code for display.
 */
export async function sortArtistsByRomanized<T>(
  items: T[],
  getKey: (item: T) => string,
  options?: { getId?: (item: T) => string; sortLanguage?: SortLanguage }
): Promise<SortArtistsResult<T>> {
  const sortLanguage = options?.sortLanguage ?? 'none';

  if (sortLanguage === 'none') {
    const sorted = [...items].sort((a, b) =>
      defaultCollator.compare(getKey(a), getKey(b))
    );
    const keyMap = new Map<string, string>();
    const langMap = new Map<string, string>();
    const getId = options?.getId;
    sorted.forEach((item) => {
      if (getId) {
        keyMap.set(getId(item), getKey(item));
        langMap.set(getId(item), 'und');
      }
    });
    return { sorted, keyMap, langMap };
  }

  const withKeys = await Promise.all(
    items.map(async (item) => ({
      item,
      ...(await romanizeWithLang(getKey(item), sortLanguage)),
    }))
  );
  const keyMap = new Map<string, string>();
  const langMap = new Map<string, string>();
  const getId = options?.getId;
  withKeys.forEach(({ item, key, lang }) => {
    if (getId) {
      keyMap.set(getId(item), key);
      langMap.set(getId(item), lang);
    }
  });
  const sorted = withKeys
    .sort((a, b) => defaultCollator.compare(a.key, b.key))
    .map(({ item }) => item);
  return { sorted, keyMap, langMap };
}
