import { describe, expect, it } from 'vitest';
import {
  COVER_ART_THUMB_ROOT_MARGIN_Y_PX,
  findCoverArtScrollRoot,
  isCoverArtThumbIntersecting,
} from './coverArtThumbVisibility.ts';

describe('coverArtThumbVisibility', () => {
  it('finds the Virtuoso scroller ancestor', () => {
    const scroller = { tag: 'scroller' };
    const thumb = {
      closest(selector: string) {
        return selector === '[data-virtuoso-scroller]' ? scroller : null;
      },
    } as unknown as Element;

    expect(findCoverArtScrollRoot(thumb)).toBe(scroller);
  });

  it('detects intersection against a scroll root with vertical margin', () => {
    const root = {
      getBoundingClientRect: () => ({
        top: 100,
        left: 0,
        right: 400,
        bottom: 500,
        width: 400,
        height: 400,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    } as Element;

    const visible = {
      getBoundingClientRect: () => ({
        top: 120,
        left: 8,
        right: 56,
        bottom: 168,
        width: 48,
        height: 48,
        x: 8,
        y: 120,
        toJSON: () => ({}),
      }),
    } as Element;

    const aboveFold = {
      getBoundingClientRect: () => ({
        top: 40,
        left: 8,
        right: 56,
        bottom: 88,
        width: 48,
        height: 48,
        x: 8,
        y: 40,
        toJSON: () => ({}),
      }),
    } as Element;

    expect(
      isCoverArtThumbIntersecting(visible, {
        root,
        rootMarginYPx: COVER_ART_THUMB_ROOT_MARGIN_Y_PX,
      }),
    ).toBe(true);
    expect(
      isCoverArtThumbIntersecting(aboveFold, {
        root,
        rootMarginYPx: COVER_ART_THUMB_ROOT_MARGIN_Y_PX,
      }),
    ).toBe(true);
  });

  it('returns false for zero-size elements', () => {
    const el = {
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as Element;

    expect(isCoverArtThumbIntersecting(el)).toBe(false);
  });
});
