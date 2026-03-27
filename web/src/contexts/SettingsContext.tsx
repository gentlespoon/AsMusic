import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SortLanguage } from '@/utils/romanize';

const STORAGE_KEY = 'asmusic-sort-language';

function loadSortLanguage(): SortLanguage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'chinese' || raw === 'japanese' || raw === 'korean' || raw === 'none')
      return raw;
  } catch {
    // ignore
  }
  return 'none';
}

type SettingsContextValue = {
  sortLanguage: SortLanguage;
  setSortLanguage: (lang: SortLanguage) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [sortLanguage, setSortLanguageState] = useState<SortLanguage>(loadSortLanguage);

  const setSortLanguage = useCallback((lang: SortLanguage) => {
    setSortLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ sortLanguage, setSortLanguage }),
    [sortLanguage, setSortLanguage]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
