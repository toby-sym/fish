import { describe, expect, it } from "vitest";
import { feedingSurfaceTarget } from "./FoodMotion";
import { FishMotion } from "./FishMotion";

describe("feedingSurfaceTarget", () => {
  it("places the attractor just below the water surface and inside fish bounds", () => {
    const bounds = { width: 14, height: 10, padding: 0.8 };
    const position = { x: 6.8, y: -2, z: 1.1 };
    const target = feedingSurfaceTarget(position, bounds, () => 1);

    expect(target.x).toBe(6.2);
    expect(target.y).toBe(3.85);
    expect(target.z).toBe(position.z);
  });

  it("steers a lower fish upward toward the surface patch", () => {
    const bounds = { width: 14, height: 10, padding: 0.8 };
    let seed = 1;
    let motion = new FishMotion(seed, bounds);
    let start = motion.update(0, bounds);
    while (start.y > 0 && seed < 100) {
      seed += 1;
      motion = new FishMotion(seed, bounds);
      start = motion.update(0, bounds);
    }
    const target = feedingSurfaceTarget(start, bounds, () => 0.5);
    motion.feedAt(target, bounds, 8);

    let current = start;
    for (let frame = 0; frame < 120; frame += 1) current = motion.update(1 / 30, bounds);

    expect(current.y).toBeGreaterThan(start.y);
    expect(Math.hypot(target.x - current.x, target.y - current.y)).toBeLessThan(
      Math.hypot(target.x - start.x, target.y - start.y),
    );
  });
});
