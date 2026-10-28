import { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { createGenome } from "../domain/random";
import { Tank } from "../domain/tank";
import { invertebrateProfiles, plantProfiles, speciesById } from "./profiles";

function starterFish(speciesId: string, name: string, sex: "female" | "male", seed: number): Fish {
  const profile = speciesById.get(speciesId);
  if (!profile) throw new Error(`Missing starter species profile: ${speciesId}`);

  return new Fish({
    id: `starter-${speciesId}-${sex}`,
    name,
    speciesId,
    speciesName: profile.commonName,
    compatibilityGroup: profile.compatibilityGroup,
    genome: createGenome(profile, seed),
    sex,
    lifeStage: "adult",
    hunger: 24,
  });
}

export function createStarterTank(): Tank {
  const snail = invertebrateProfiles[0];
  const shrimp = invertebrateProfiles[1];
  const starterPlant = (speciesId: string, x: number, z: number): Plant => {
    const profile = plantProfiles.find((item) => item.id === speciesId);
    if (!profile) throw new Error(`Missing starter plant profile: ${speciesId}`);
    return new Plant({
      id: `starter-${speciesId}`,
      name: profile.commonName,
      speciesId: profile.id,
      nitrateUptakePerMinute: profile.nitrateUptakePerMinute,
      oxygenProductionPerMinute: profile.oxygenProductionPerMinute,
      visualSeed: profile.visualSeed,
      colour: profile.colour,
      growthForm: profile.growthForm,
      position: { x, y: 0, z },
    });
  };

  return new Tank({
    id: "freshwater-main",
    name: "Freshwater habitat",
    fish: [
      starterFish("guppy", "Copper", "male", 1001),
      starterFish("guppy", "Ripple", "female", 1002),
      starterFish("endler", "Sunny", "male", 2001),
      starterFish("endler", "Fern", "female", 2002),
    ],
    plants: [
      starterPlant("java-fern", -3.1, -0.4),
      starterPlant("hornwort", 3, 0.1),
      starterPlant("anubias", -5.1, 0.15),
      starterPlant("cryptocoryne", 0.1, -0.3),
      starterPlant("vallisneria", 5.05, -0.6),
      starterPlant("red-lotus", -1.65, 0.35),
    ],
    invertebrates: [
      new AquaticInvertebrate({ id: "starter-snail", name: "Pebble", speciesId: snail.id, detritusConsumptionPerMinute: snail.detritusConsumptionPerMinute, wastePerMinute: snail.wastePerMinute, oxygenConsumptionPerMinute: snail.oxygenConsumptionPerMinute, colour: snail.colour, position: { x: 2.4, y: 0.18, z: 0.6 } }),
      new AquaticInvertebrate({ id: "starter-shrimp", name: "Coral", speciesId: shrimp.id, detritusConsumptionPerMinute: shrimp.detritusConsumptionPerMinute, wastePerMinute: shrimp.wastePerMinute, oxygenConsumptionPerMinute: shrimp.oxygenConsumptionPerMinute, colour: shrimp.colour, position: { x: -2, y: 0.15, z: 0.5 } }),
    ],
    bacteriaLevel: 82,
    filterCondition: 94,
  });
}
