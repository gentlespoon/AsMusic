import type { MutableRefObject, Ref } from 'react';

/** Assigns the instance to every ref in the list (callback refs and object refs). */
export function mergeRefs<T>(...refs: (Ref<T> | undefined | null)[]): Ref<T> {
  return (instance: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === 'function') {
        ref(instance);
      } else {
        (ref as MutableRefObject<T | null>).current = instance;
      }
    }
  };
}
