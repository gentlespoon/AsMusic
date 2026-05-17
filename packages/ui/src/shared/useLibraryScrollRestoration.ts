import { useEffect, useLayoutEffect, useRef } from 'react';
import { libraryScrollMemory } from './libraryScrollMemory';

/**
 * Persists `scrollTop` for a scrollable element while mounted, restores on mount (e.g. after `navigate(-1)`).
 */
export function useLibraryScrollRestoration(scrollKey: string | undefined) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scrollKey) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = libraryScrollMemory.get(scrollKey) ?? 0;
    el.scrollTop = saved;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = libraryScrollMemory.get(scrollKey) ?? 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollKey]);

  useEffect(() => {
    if (!scrollKey) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => libraryScrollMemory.set(scrollKey, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      libraryScrollMemory.set(scrollKey, el.scrollTop);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollKey]);

  return scrollRef;
}
