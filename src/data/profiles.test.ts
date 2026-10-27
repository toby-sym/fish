import { describe, expect, it } from "vitest";
import { invertebrateProfiles, plantProfiles, speciesProfiles } from "./profiles";
import { createGenome } from "../domain/random";

describe("procedural organism profiles", () => {
  it("offers species, plants, and invertebrates with distinct visual profiles", () => {
    expect(speciesProfiles.length).toBeGreaterThanOrEqual(15);
    expect(plantProfiles.length).toBeGreaterThanOrEqual(6);
    expect(invertebrateProfiles.length).toBeGreaterThanOrEqual(4);
    expect(new Set(speciesProfiles.map((profile) => profile.compatibilityGroup)).size).toBeGreaterThan(4);
    expect(speciesProfiles.some((profile) => profile.visual.tailShape === "veil")).toBe(true);
    expect(speciesProfiles.some((profile) => profile.visual.tailShape === "forked")).toBe(true);
    expect(new Set(plantProfiles.map((profile) => profile.growthForm)).size).toBeGreaterThan(3);
  });

  it("generates repeatable but visibly varied fish phenotypes", () => {
    const guppy = speciesProfiles.find((profile) => profile.id === "guppy");
    if (!guppy) throw new Error("Guppy profile missing.");

    const first = createGenome(guppy, 551);
    expect(createGenome(guppy, 551)).toEqual(first);

    const phenotypes = Array.from({ length: 20 }, (_, index) => createGenome(guppy, 1000 + index).visual);
    expect(new Set(phenotypes.map((visual) => visual.primaryColour)).size).toBeGreaterThan(10);
    expect(new Set(phenotypes.map((visual) => visual.pattern)).size).toBeGreaterThan(1);
    expect(phenotypes.every((visual) => visual.bodyShape && visual.tailShape)).toBe(true);
  });
});
