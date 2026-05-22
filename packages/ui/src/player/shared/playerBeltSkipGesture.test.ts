import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
    assert.equal(
      simulate([{ h: -40 }], { h: -40 }),
      'next',
    );
  });

  it('cancels when reversing slightly right after arming next', () => {
    assert.equal(
      simulate([{ h: -40 }, { h: 5 }], { h: 5 }),
      null,
    );
  });

  it('does not commit previous when reversing past center after arming next', () => {
    assert.equal(
      simulate([{ h: -40 }, { h: 50 }], { h: 50 }),
      null,
    );
  });

  it('cancels when returning to neutral band after arming next', () => {
    assert.equal(
      simulate([{ h: -40 }, { h: 0 }], { h: -40 }),
      null,
    );
  });

  it('commits previous when swipe right past threshold and releases right', () => {
    assert.equal(
      simulate([{ h: 40 }], { h: 40 }),
      'previous',
    );
  });

  it('does not arm next when hasNext is false', () => {
    const state = createBeltSkipGestureState();
    updateBeltSkipGestureState(state, -40, 0, {
      hasNext: false,
      hasPrevious: true,
    });
    assert.equal(state.armed, null);
    assert.equal(resolveBeltSkipCommit(state, -40, 0), null);
  });

  it('reset clears armed and cancelled', () => {
    const state = createBeltSkipGestureState();
    updateBeltSkipGestureState(state, -40, 0, opts);
    updateBeltSkipGestureState(state, 5, 0, opts);
    assert.equal(state.cancelled, true);
    resetBeltSkipGestureState(state);
    assert.equal(state.armed, null);
    assert.equal(state.cancelled, false);
  });

  it('does not commit if release is short of threshold in armed direction', () => {
    assert.equal(
      simulate([{ h: -40 }], { h: -20 }),
      null,
    );
  });

  it('uses cancel slop and swipe threshold constants', () => {
    assert.equal(BELT_SWIPE_THRESHOLD, 28);
    assert.equal(BELT_CANCEL_SLOP, 12);
  });
});
