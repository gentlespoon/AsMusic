/**
 * Sort helpers: locale-aware alphabetical and track-number order.
 */

const defaultCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  usage: 'sort',
});

/**
 * Returns a new array sorted by the string key using locale-aware comparison.
 */
export function sortByLocale<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort((a, b) => defaultCollator.compare(getKey(a), getKey(b)));
}

/**
 * Compare two strings with the default locale collator (for use in .sort()).
 */
export function compareLocale(a: string, b: string): number {
  return defaultCollator.compare(a, b);
}

type WithTrack = { discNumber?: number; track?: number; title?: string };

/**
 * Returns a new array of album tracks sorted by disc number then track number.
 * Items without track number are ordered after numbered tracks, then by title.
 */
export function sortByTrackNumber<T extends WithTrack>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const discA = a.discNumber ?? 0;
    const discB = b.discNumber ?? 0;
    if (discA !== discB) return discA - discB;
    const trackA = a.track ?? 999999;
    const trackB = b.track ?? 999999;
    if (trackA !== trackB) return trackA - trackB;
    return defaultCollator.compare(a.title ?? '', b.title ?? '');
  });
}
