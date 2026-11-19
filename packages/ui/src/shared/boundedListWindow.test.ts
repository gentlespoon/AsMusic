import { describe, expect, it } from "vitest";
import { BOUNDED_LIST_WINDOW, boundedWindowStart, nextBoundedWindowStart } from "./boundedListWindow";

describe("boundedWindowStart", () => {
  it("keeps a short list at the start", () => {
    expect(boundedWindowStart(40, 80)).toBe(0);
  });

  it("pins a restored row a short distance below the top", () => {
    expect(boundedWindowStart(500, 50_000)).toBe(420);
  });

  it("does not run past the end of a long list", () => {
    expect(boundedWindowStart(49_900, 50_000)).toBe(50_000 - BOUNDED_LIST_WINDOW);
  });
});

describe("nextBoundedWindowStart", () => {
  it("slides down and leaves room below the pinned row", () => {
    const next = nextBoundedWindowStart({
      start: 0,
      length: 50_000,
      rangeStart: 370,
      rangeEnd: 399,
    });
    expect(next).toEqual({
      start: 399 - (BOUNDED_LIST_WINDOW - 1 - 80),
      anchorIndex: 399,
      align: "end",
    });
  });
});
