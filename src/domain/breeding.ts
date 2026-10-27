import { Fish } from "./entities";
import { seededRandom } from "./random";
import type { SpeciesProfile } from "./types";

export class BreedingSystem {
  canBreed(first: Fish, second: Fish): boolean {
    return first.id !== second.id
      && first.compatibilityGroup === second.compatibilityGroup
      && first.sex !== "unknown"
      && second.sex !== "unknown"
      && first.sex !== second.sex
      && first.lifeStage === "adult"
      && second.lifeStage === "adult"
      && first.health >= 55
      && second.health >= 55;
  }

  createOffspring(first: Fish, second: Fish, profiles: Map<string, SpeciesProfile>, seed: number): Fish {
    if (!this.canBreed(first, second)) {
      throw new Error("Choose a healthy adult female and male from a compatible group.");
    }

    const profileA = profiles.get(first.genome.lineageSpeciesIds[0] ?? first.speciesId);
    const profileB = profiles.get(second.genome.lineageSpeciesIds[0] ?? second.speciesId);
    if (!profileA || !profileB) throw new Error("A parent species profile is missing.");

    const random = seededRandom(seed);
    const blend = (a: number, b: number, variation: number) => {
      const midpoint = (a + b) / 2;
      return midpoint * (1 + (random() - 0.5) * variation);
    };
    const parentVisualA = first.genome.visual;
    const parentVisualB = second.genome.visual;
    const visual = {
      bodyShape: random() < 0.5
        ? parentVisualA.bodyShape ?? profileA.visual.bodyShape
        : parentVisualB.bodyShape ?? profileB.visual.bodyShape,
      tailShape: random() < 0.5
        ? parentVisualA.tailShape ?? profileA.visual.tailShape
        : parentVisualB.tailShape ?? profileB.visual.tailShape,
      bodyLength: blend(parentVisualA.bodyLength, parentVisualB.bodyLength, 0.08),
      bodyHeight: blend(parentVisualA.bodyHeight, parentVisualB.bodyHeight, 0.08),
      bodyDepth: blend(parentVisualA.bodyDepth, parentVisualB.bodyDepth, 0.08),
      tailSize: blend(parentVisualA.tailSize, parentVisualB.tailSize, 0.16),
      dorsalFinSize: blend(parentVisualA.dorsalFinSize, parentVisualB.dorsalFinSize, 0.12),
      pattern: random() < 0.5 ? parentVisualA.pattern : parentVisualB.pattern,
      primaryColour: random() < 0.5 ? parentVisualA.primaryColour : parentVisualB.primaryColour,
      secondaryColour: random() < 0.5 ? parentVisualA.secondaryColour : parentVisualB.secondaryColour,
      accentColour: random() < 0.5 ? parentVisualA.accentColour : parentVisualB.accentColour,
      seed: Math.floor(random() * 0xffffffff),
    };

    const hybrid = first.speciesId !== second.speciesId || first.speciesId === "hybrid" || second.speciesId === "hybrid";
    const parentSpeciesIds = [...new Set([...first.parentSpeciesIds, ...second.parentSpeciesIds])];
    const speciesName = hybrid
      ? `${profileA.commonName} × ${profileB.commonName} hybrid`
      : profileA.commonName;

    return new Fish({
      name: hybrid ? "Hybrid fry" : `${profileA.commonName} fry`,
      speciesId: hybrid ? "hybrid" : profileA.id,
      speciesName,
      compatibilityGroup: first.compatibilityGroup,
      genome: { visual, lineageSpeciesIds: parentSpeciesIds },
      sex: random() < 0.5 ? "female" : "male",
      lifeStage: "juvenile",
      health: 100,
      hunger: 0,
      parentIds: [first.id, second.id],
      parentSpeciesIds,
    });
  }
}
