import type { LibraryBrowserTab } from '@ui/views/home/library/browser/libraryNavigationUrl';

const STORAGE_KEY = 'asmusic-library-browser-tab-v1';

const VALID_TABS: readonly LibraryBrowserTab[] = [
  'albums',
  'artists',
  'songs',
  'favorites',
  'playlists',
];

function isLibraryBrowserTab(raw: string | null): raw is LibraryBrowserTab {
  return VALID_TABS.includes(raw as LibraryBrowserTab);
}

export function getLibraryBrowserTab(): LibraryBrowserTab {
  try {
    if (typeof localStorage === 'undefined') return 'albums';
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLibraryBrowserTab(raw) ? raw : 'albums';
  } catch {
    return 'albums';
  }
}

export function setLibraryBrowserTab(next: LibraryBrowserTab): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}
