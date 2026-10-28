import { describe, expect, it } from "vitest";
import { AnimationClock } from "./AnimationClock";

describe("AnimationClock", () => {
  it("advances from active frame deltas and stays still across a pause", () => {
    const clock = new AnimationClock();

    expect(clock.advance(0.1)).toBeCloseTo(0.1);
    expect(clock.advance(0)).toBeCloseTo(0.1);
    expect(clock.advance(0.2)).toBeCloseTo(0.3);
  });

  it("caps a delayed frame so resumed animation cannot jump", () => {
    const clock = new AnimationClock();

    expect(clock.advance(8)).toBeCloseTo(0.25);
  });
});
