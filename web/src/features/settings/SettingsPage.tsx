import { useSettings, type SortLanguage } from '@/contexts';

const OPTIONS: { value: SortLanguage; label: string }[] = [
  { value: 'none', label: 'None (sort as-is)' },
  { value: 'chinese', label: 'Chinese (Pinyin)' },
  { value: 'japanese', label: 'Japanese (Romaji)' },
  { value: 'korean', label: 'Korean (Romanization)' },
];

export function SettingsPage() {
  const { sortLanguage, setSortLanguage } = useSettings();

  return (
    <div className="settings">
      <header className="library__header">
        <h1 className="library__title">Settings</h1>
      </header>
      <section className="settings__section">
        <label htmlFor="sort-language" className="settings__label">
          Sort non-Latin artist names by
        </label>
        <select
          id="sort-language"
          className="settings__select"
          value={sortLanguage}
          onChange={(e) => setSortLanguage(e.target.value as SortLanguage)}
          aria-describedby="sort-language-hint"
        >
          {OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p id="sort-language-hint" className="settings__hint">
          Applies to Artist list and Search results. Choose the language used for
          romanizing names (e.g. 周杰伦 → Pinyin) for alphabetical sorting.
        </p>
      </section>
    </div>
  );
}
