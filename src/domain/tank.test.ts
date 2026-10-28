import { describe, expect, it } from "vitest";
import { createStarterTank } from "../data/starterTank";

describe("Tank", () => {
  it("starts with rooted and floating plant forms", () => {
    const growthForms = createStarterTank().plants.map((plant) => plant.growthForm);

    expect(growthForms).toContain("ribbon");
    expect(growthForms).toContain("floating");
  });

  it("feeds and renames an individual fish", () => {
    const tank = createStarterTank();
    const fish = tank.fish[0];

    expect(tank.feedFish(fish.id)).toBe(1);
    expect(fish.hunger).toBe(0);

    tank.renameFish(fish.id, "  Pebble  ");
    expect(fish.name).toBe("Pebble");
    expect(() => tank.renameFish(fish.id, "  ")).toThrow("A fish name cannot be empty.");
  });

  it("refreshes water and reduces dissolved waste", () => {
    const tank = createStarterTank();
    tank.chemistry.ammoniaMgL = 0.4;
    tank.chemistry.nitriteMgL = 0.2;
    tank.chemistry.nitrateMgL = 20;
    tank.detritus = 2;

    tank.waterChange(0.25);

    expect(tank.chemistry.ammoniaMgL).toBeCloseTo(0.3);
    expect(tank.chemistry.nitriteMgL).toBeCloseTo(0.15);
    expect(tank.chemistry.nitrateMgL).toBe(15);
    expect(tank.detritus).toBe(1.5);
  });
});
