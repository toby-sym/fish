import { describe, expect, it } from "vitest";
import { FishMotion } from "./FishMotion";

describe("FishMotion", () => {
  it("moves through the available screen space with repeatable waypoints", () => {
    const bounds = { width: 24, height: 10, padding: 0.8 };
    const first = new FishMotion(88, bounds);
    const second = new FishMotion(88, bounds);
    const positions = [];

    for (let frame = 0; frame < 3600; frame += 1) {
      const a = first.update(1 / 30, bounds);
      const b = second.update(1 / 30, bounds);
      expect(a).toEqual(b);
      expect(Math.abs(a.x)).toBeLessThanOrEqual(bounds.width / 2 - bounds.padding);
      expect(Math.abs(a.y)).toBeLessThanOrEqual(bounds.height / 2 - bounds.padding);
      positions.push(a);
    }

    expect(Math.max(...positions.map((position) => position.x))).toBeGreaterThan(bounds.width * 0.3);
    expect(Math.min(...positions.map((position) => position.x))).toBeLessThan(-bounds.width * 0.3);
    expect(Math.max(...positions.map((position) => position.y))).toBeGreaterThan(bounds.height * 0.2);
    expect(Math.min(...positions.map((position) => position.y))).toBeLessThan(-bounds.height * 0.2);
  });

  it("clamps an existing fish to a resized viewport without advancing time", () => {
    const motion = new FishMotion(201, { width: 22, height: 10 });
    const resized = { width: 7, height: 4, padding: 0.6 };
    const position = motion.update(0, resized);

    expect(Math.abs(position.x)).toBeLessThanOrEqual(2.9);
    expect(Math.abs(position.y)).toBeLessThanOrEqual(1.4);
  });

  it("steers a fed fish toward the falling food", () => {
    const bounds = { width: 14, height: 8, padding: 0.8 };
    const padding = bounds.padding ?? 0.7;
    const motion = new FishMotion(912, bounds);
    const start = motion.update(0, bounds);
    const target = {
      x: Math.min(bounds.width / 2 - padding, start.x + 1.3),
      y: Math.min(bounds.height / 2 - padding, start.y + 0.5),
      z: start.z,
    };
    const initialDistance = Math.hypot(target.x - start.x, target.y - start.y);
    motion.feedAt(target, bounds);

    let position = start;
    for (let frame = 0; frame < 45; frame += 1) position = motion.update(1 / 30, bounds);

    expect(Math.hypot(target.x - position.x, target.y - position.y)).toBeLessThan(initialDistance);
  });
});
