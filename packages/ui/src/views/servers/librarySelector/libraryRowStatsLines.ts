import type { I18nContextValue, I18nFormatters } from '@asmusic/i18n';
import type { LibraryRowCacheStats } from './types';

export function libraryRowStatsLines(
  stats: LibraryRowCacheStats | null | undefined,
  t: I18nContextValue['t'],
  format: I18nFormatters
): {
  counts: string;
  sync: string | null;
} {
  if (stats === undefined) {
    return { counts: t('servers.libraries.statsLoading'), sync: null };
  }
  if (stats === null) {
    return { counts: t('servers.libraries.statsError'), sync: null };
  }
  if (stats.lastSyncAt == null && stats.songCount === 0 && stats.albumCount === 0) {
    return { counts: t('servers.libraries.noCacheYet'), sync: null };
  }
  const counts = t('servers.libraries.counts', {
    albums: format.number(stats.albumCount),
    songs: format.number(stats.songCount),
  });
  const sync =
    stats.lastSyncAt == null
      ? t('servers.libraries.lastSyncNever')
      : t('servers.libraries.lastSync', {
          when: format.dateTime(new Date(stats.lastSyncAt)),
        });
  return { counts, sync };
}
