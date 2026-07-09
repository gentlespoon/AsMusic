export const COVER_ART_THUMB_ROOT_MARGIN_Y_PX = 120;

const VIRTUOSO_SCROLLER_SELECTOR = '[data-virtuoso-scroller]';

/** Virtuoso list scroll container, when the thumb lives inside a virtualized list. */
export function findCoverArtScrollRoot(el: Element): Element | null {
  return el.closest(VIRTUOSO_SCROLLER_SELECTOR);
}

type IntersectionCheckOptions = {
  root?: Element | null;
  rootMarginYPx?: number;
};

/** Mirrors IntersectionObserver visibility for the thumb's lazy-load gate. */
export function isCoverArtThumbIntersecting(
  el: Element,
  options: IntersectionCheckOptions = {},
): boolean {
  const rootMarginYPx = options.rootMarginYPx ?? COVER_ART_THUMB_ROOT_MARGIN_Y_PX;
  const elRect = el.getBoundingClientRect();
  if (elRect.width <= 0 || elRect.height <= 0) return false;

  const rootRect = options.root
    ? options.root.getBoundingClientRect()
    : {
        top: 0,
        left: 0,
        right: globalThis.innerWidth ?? 0,
        bottom: globalThis.innerHeight ?? 0,
      };

  const top = rootRect.top - rootMarginYPx;
  const bottom = rootRect.bottom + rootMarginYPx;
  const left = rootRect.left;
  const right = rootRect.right;

  return (
    elRect.bottom > top &&
    elRect.top < bottom &&
    elRect.right > left &&
    elRect.left < right
  );
}
