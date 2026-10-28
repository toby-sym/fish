import { describe, expect, it } from "vitest";
import { InvertebrateMotion } from "./InvertebrateMotion";

describe("InvertebrateMotion", () => {
  it("moves a shrimp with repeatable wandering and occasional vertical exploration", () => {
    const start = { x: -1, y: -4.7, z: 0, direction: 1 as const };
    const first = new InvertebrateMotion(321, "shrimp", start, 16);
    const second = new InvertebrateMotion(321, "shrimp", start, 16);
    const path = [];

    for (let frame = 0; frame < 900; frame += 1) {
      const a = first.update(1 / 30);
      const b = second.update(1 / 30);
      expect(a).toEqual(b);
      expect(a.x).toBeGreaterThanOrEqual(-7.55);
      expect(a.x).toBeLessThanOrEqual(7.55);
      path.push(a);
    }

    expect(Math.max(...path.map((point) => point.x)) - Math.min(...path.map((point) => point.x))).toBeGreaterThan(2);
    expect(Math.max(...path.map((point) => point.y))).toBeGreaterThan(start.y + 0.1);
  });

  it("keeps a snail close to the substrate and turns it around at the glass", () => {
    const snail = new InvertebrateMotion(91, "snail", { x: 7.4, y: -4.8, z: 0.2, direction: 1 }, 16);
    let position = snail.update(0);

    for (let frame = 0; frame < 1800; frame += 1) {
      position = snail.update(1 / 30);
      expect(position.x).toBeGreaterThanOrEqual(-7.55);
      expect(position.x).toBeLessThanOrEqual(7.55);
      expect(position.y).toBeLessThan(-4.7);
    }

    expect(position.x).toBeLessThan(7.4);
  });

  it("clamps to a narrower viewport without advancing animation time", () => {
    const shrimp = new InvertebrateMotion(92, "shrimp", { x: 7.4, y: -4.7, z: 0.2, direction: 1 }, 16);
    const resized = shrimp.update(0, 8);

    expect(resized.x).toBe(3.55);
    expect(shrimp.update(0, 8)).toEqual(resized);
  });
});
