import { describe, expect, it } from "vitest";
import { createGenome } from "./random";
import { Fish } from "./entities";
import { createStarterTank } from "../data/starterTank";
import { speciesById } from "../data/profiles";
import { BreedingSystem } from "./breeding";

describe("BreedingSystem", () => {
  const system = new BreedingSystem();

  it("creates a named hybrid juvenile from compatible parents", () => {
    const fish = createStarterTank().fish;
    const female = fish.find((item) => item.speciesId === "guppy" && item.sex === "female");
    const male = fish.find((item) => item.speciesId === "endler" && item.sex === "male");
    expect(female).toBeDefined();
    expect(male).toBeDefined();
    if (!female || !male) throw new Error("Starter compatible pair missing.");

    const offspring = system.createOffspring(female, male, speciesById, 12345);

    expect(offspring.speciesId).toBe("hybrid");
    expect(offspring.lifeStage).toBe("juvenile");
    expect(offspring.parentIds).toEqual([female.id, male.id]);
    expect(offspring.parentSpeciesIds).toEqual(["guppy", "endler"]);
    expect(Number.isFinite(offspring.genome.visual.bodyLength)).toBe(true);
  });

  it("rejects parents from separate compatibility groups", () => {
    const fish = createStarterTank().fish;
    const female = fish.find((item) => item.speciesId === "guppy" && item.sex === "female");
    const male = fish.find((item) => item.speciesId === "endler" && item.sex === "male");
    if (!female || !male) throw new Error("Starter fish missing.");

    const platyProfile = speciesById.get("platy");
    expect(platyProfile).toBeDefined();
    if (!platyProfile) throw new Error("Platy profile missing.");
    const platy = new Fish({
      name: "Platy",
      speciesId: platyProfile.id,
      speciesName: platyProfile.commonName,
      compatibilityGroup: platyProfile.compatibilityGroup,
      genome: createGenome(platyProfile, 321),
      sex: "male",
      lifeStage: "adult",
    });

    expect(system.canBreed(female, platy)).toBe(false);
    expect(() => system.createOffspring(female, platy, speciesById, 12345)).toThrow(
      "Choose a healthy adult female and male from a compatible group.",
    );
  });
});
