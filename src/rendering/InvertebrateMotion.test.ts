import { describe, expect, it } from "vitest";
import { InvertebrateMotion } from "./InvertebrateMotion";

describe("InvertebrateMotion", () => {
  it("moves shrimp and snails along the tank floor deterministically", () => {
    const start = { x: 0, y: -4.5, z: 0.4, direction: 1 as const };
    const shrimp = new InvertebrateMotion(413, "shrimp", start, 12);
    const sameShrimp = new InvertebrateMotion(413, "shrimp", start, 12);
    const snail = new InvertebrateMotion(413, "snail", start, 12);
    let shrimpTravel = 0;
    let snailTravel = 0;
    let previousShrimp = start.x;
    let previousSnail = start.x;

    for (let frame = 0; frame < 120; frame += 1) {
      const shrimpPosition = shrimp.update(0.1, 12);
      const repeatedPosition = sameShrimp.update(0.1, 12);
      const snailPosition = snail.update(0.1, 12);
      expect(shrimpPosition).toEqual(repeatedPosition);
      expect(Math.abs(shrimpPosition.x)).toBeLessThanOrEqual(5.5);
      expect(Math.abs(snailPosition.x)).toBeLessThanOrEqual(5.5);
      expect(shrimpPosition.y).toBeGreaterThan(-4.6);
      expect(shrimpPosition.y).toBeLessThan(-4.4);
      expect(snailPosition.y).toBe(-4.5);
      shrimpTravel += Math.abs(shrimpPosition.x - previousShrimp);
      snailTravel += Math.abs(snailPosition.x - previousSnail);
      previousShrimp = shrimpPosition.x;
      previousSnail = snailPosition.x;
    }

    expect(shrimpTravel).toBeGreaterThan(1);
    expect(snailTravel).toBeGreaterThan(0.2);
    expect(shrimpTravel).toBeGreaterThan(snailTravel);
  });
});
