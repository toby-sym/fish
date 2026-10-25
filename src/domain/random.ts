import type { FishGenome, SpeciesProfile } from "./types";

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createGenome(profile: SpeciesProfile, seed: number): FishGenome {
  const random = seededRandom(seed);
  const visual = profile.visual;
  const variation = (amount: number) => 1 + (random() - 0.5) * amount;

  return {
    visual: {
      ...visual,
      bodyLength: visual.bodyLength * variation(0.12),
      bodyHeight: visual.bodyHeight * variation(0.12),
      bodyDepth: visual.bodyDepth * variation(0.12),
      tailSize: visual.tailSize * variation(0.2),
      dorsalFinSize: visual.dorsalFinSize * variation(0.18),
      seed: Math.floor(random() * 0xffffffff),
    },
    lineageSpeciesIds: [profile.id],
  };
}
