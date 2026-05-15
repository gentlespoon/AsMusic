/** In-memory scroll offsets for library drill-down (survives remounts on history back). */
const store = new Map<string, number>();

export const libraryScrollMemory = {
  get(key: string): number | undefined {
    return store.get(key);
  },
  set(key: string, y: number): void {
    store.set(key, y);
  },
};
