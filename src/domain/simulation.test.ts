import { describe, expect, it } from "vitest";
import { speciesById } from "../data/profiles";
import { createStarterTank } from "../data/starterTank";
import { EcosystemSimulation } from "./simulation";

describe("EcosystemSimulation", () => {
  it("advances in fixed one-second steps", () => {
    const tank = createStarterTank();
    const simulation = new EcosystemSimulation();
    const fish = tank.fish[0];

    simulation.advance(tank, speciesById, 0.25);
    simulation.advance(tank, speciesById, 0.25);
    simulation.advance(tank, speciesById, 0.25);
    expect(fish.ageMinutes).toBe(0);

    simulation.advance(tank, speciesById, 0.25);
    expect(fish.ageMinutes).toBeCloseTo(1 / 60);
    expect(fish.hunger).toBeGreaterThan(24);
  });

  it("drops unelapsed partial time when its clock is reset", () => {
    const tank = createStarterTank();
    const simulation = new EcosystemSimulation();
    simulation.advance(tank, speciesById, 0.25);
    simulation.advance(tank, speciesById, 0.25);
    simulation.resetClock();

    for (let index = 0; index < 4; index += 1) simulation.advance(tank, speciesById, 0.25);
    expect(tank.fish[0].ageMinutes).toBeCloseTo(1 / 60);
  });
});
