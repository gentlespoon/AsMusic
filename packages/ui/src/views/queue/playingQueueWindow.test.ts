import { describe, expect, it } from "vitest";
import {
  PLAYING_QUEUE_WINDOW,
  nextPlayingQueueWindowStart,
  playingQueueWindowStart,
} from "./playingQueueWindow";

describe("playingQueueWindowStart", () => {
  it("keeps a short queue at the start", () => {
    expect(playingQueueWindowStart(10, 40)).toBe(0);
  });

  it("centers a far index inside the window", () => {
    expect(playingQueueWindowStart(20_000, 50_000)).toBe(20_000 - PLAYING_QUEUE_WINDOW / 2);
  });

  it("does not run past the end of the queue", () => {
    expect(playingQueueWindowStart(49_900, 50_000)).toBe(50_000 - PLAYING_QUEUE_WINDOW);
  });
});

describe("nextPlayingQueueWindowStart", () => {
  it("does not move while the viewport is in the middle of the window", () => {
    expect(
      nextPlayingQueueWindowStart({
        start: 5_000,
        length: 50_000,
        rangeStart: 180,
        rangeEnd: 192,
      }),
    ).toBeNull();
  });

  it("slides upward and leaves the pinned row away from the top edge", () => {
    const next = nextPlayingQueueWindowStart({
      start: 5_000,
      length: 50_000,
      rangeStart: 2,
      rangeEnd: 14,
    });
    expect(next).toEqual({ start: 5_002 - 80, anchorIndex: 5_002, align: "start" });
  });

  it("does not slide above the first row", () => {
    expect(
      nextPlayingQueueWindowStart({
        start: 0,
        length: 50_000,
        rangeStart: 0,
        rangeEnd: 12,
      }),
    ).toBeNull();
  });
});
