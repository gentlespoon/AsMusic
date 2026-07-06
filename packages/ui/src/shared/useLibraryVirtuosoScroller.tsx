import { forwardRef, useMemo } from 'react';
import type { Ref, RefObject } from 'react';
import type { ScrollerProps } from 'react-virtuoso';
import { mergeRefs } from '@ui/utils/mergeRefs';

/**
 * Virtuoso / VirtuosoGrid scroll container that shares the DOM node with {@link useLibraryScrollRestoration}.
 */
export function useLibraryVirtuosoScroller(scrollRef: RefObject<HTMLDivElement | null>) {
  return useMemo(
    () => ({
      Scroller: forwardRef<HTMLDivElement, ScrollerProps>(function LibraryVirtuosoScroller(props, ref) {
        const { style, ...rest } = props;
        return (
          <div
            ref={mergeRefs(ref, scrollRef as Ref<HTMLDivElement>)}
            {...rest}
            style={{
              ...style,
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: 'auto',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          />
        );
      }),
    }),
    [scrollRef]
  );
}
