import { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { createGenome } from "../domain/random";
import { Tank } from "../domain/tank";
import { invertebrateProfiles, speciesById } from "./profiles";

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
      new Plant({ id: "starter-java-fern", name: "Java fern", speciesId: "java-fern", nitrateUptakePerMinute: 0.012, oxygenProductionPerMinute: 0.008, visualSeed: 104, colour: 0x4a966c, growthForm: "fern", position: { x: -3.1, y: 0, z: -0.4 } }),
      new Plant({ id: "starter-hornwort", name: "Hornwort", speciesId: "hornwort", nitrateUptakePerMinute: 0.018, oxygenProductionPerMinute: 0.012, visualSeed: 312, colour: 0x3f8b63, growthForm: "stem", position: { x: 3, y: 0, z: 0.1 } }),
    ],
    invertebrates: [
      new AquaticInvertebrate({ id: "starter-snail", name: "Pebble", speciesId: snail.id, detritusConsumptionPerMinute: snail.detritusConsumptionPerMinute, wastePerMinute: snail.wastePerMinute, oxygenConsumptionPerMinute: snail.oxygenConsumptionPerMinute, colour: snail.colour, position: { x: 2.4, y: 0.18, z: 0.6 } }),
      new AquaticInvertebrate({ id: "starter-shrimp", name: "Coral", speciesId: shrimp.id, detritusConsumptionPerMinute: shrimp.detritusConsumptionPerMinute, wastePerMinute: shrimp.wastePerMinute, oxygenConsumptionPerMinute: shrimp.oxygenConsumptionPerMinute, colour: shrimp.colour, position: { x: -2, y: 0.15, z: 0.5 } }),
    ],
    bacteriaLevel: 82,
    filterCondition: 94,
  });
}
