import { describe, expect, it } from 'vitest';
import {
  BELT_CANCEL_SLOP,
  BELT_SWIPE_THRESHOLD,
  createBeltSkipGestureState,
  resetBeltSkipGestureState,
  resolveBeltSkipCommit,
  updateBeltSkipGestureState,
} from './playerBeltSkipGesture.ts';

const opts = { hasNext: true, hasPrevious: true };

function simulate(
  moves: Array<{ h: number; v?: number }>,
  release: { h: number; v?: number },
): 'next' | 'previous' | null {
  const state = createBeltSkipGestureState();
  for (const { h, v = 0 } of moves) {
    updateBeltSkipGestureState(state, h, v, opts);
  }
  const { h, v = 0 } = release;
  return resolveBeltSkipCommit(state, h, v);
}

describe('playerBeltSkipGesture', () => {
  it('commits next when swipe left past threshold and releases left', () => {
    expect(simulate([{ h: -40 }], { h: -40 })).toBe('next');
  });

  it('cancels when reversing slightly right after arming next', () => {
    expect(simulate([{ h: -40 }, { h: 5 }], { h: 5 })).toBeNull();
  });

  it('does not commit previous when reversing past center after arming next', () => {
    expect(simulate([{ h: -40 }, { h: 50 }], { h: 50 })).toBeNull();
  });

  it('cancels when returning to neutral band after arming next', () => {
    expect(simulate([{ h: -40 }, { h: 0 }], { h: -40 })).toBeNull();
  });

  it('commits previous when swipe right past threshold and releases right', () => {
    expect(simulate([{ h: 40 }], { h: 40 })).toBe('previous');
  });

  it('does not arm next when hasNext is false', () => {
    const state = createBeltSkipGestureState();
    updateBeltSkipGestureState(state, -40, 0, {
      hasNext: false,
      hasPrevious: true,
    });
    expect(state.armed).toBeNull();
    expect(resolveBeltSkipCommit(state, -40, 0)).toBeNull();
  });

  it('reset clears armed and cancelled', () => {
    const state = createBeltSkipGestureState();
    updateBeltSkipGestureState(state, -40, 0, opts);
    updateBeltSkipGestureState(state, 5, 0, opts);
    expect(state.cancelled).toBe(true);
    resetBeltSkipGestureState(state);
    expect(state.armed).toBeNull();
    expect(state.cancelled).toBe(false);
  });

  it('does not commit if release is short of threshold in armed direction', () => {
    expect(simulate([{ h: -40 }], { h: -20 })).toBeNull();
  });

  it('uses cancel slop and swipe threshold constants', () => {
    expect(BELT_SWIPE_THRESHOLD).toBe(28);
    expect(BELT_CANCEL_SLOP).toBe(12);
  });
});
