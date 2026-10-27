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
  const patterns = ["solid", "stripe", "mottled", "speckled", "banded", "marbled"] as const;
  const phenotypeRandom = seededRandom(mixSeed(seed));
  const pattern = phenotypeRandom() < 0.62
    ? patterns[Math.floor(phenotypeRandom() * patterns.length)]
    : visual.pattern;

  return {
    visual: {
      ...visual,
      pattern,
      bodyLength: visual.bodyLength * variation(0.12),
      bodyHeight: visual.bodyHeight * variation(0.12),
      bodyDepth: visual.bodyDepth * variation(0.12),
      tailSize: visual.tailSize * variation(0.2),
      dorsalFinSize: visual.dorsalFinSize * variation(0.18),
      primaryColour: varyColour(visual.primaryColour, random),
      secondaryColour: varyColour(visual.secondaryColour, random),
      accentColour: varyColour(visual.accentColour, random),
      seed: Math.floor(random() * 0xffffffff),
    },
    lineageSpeciesIds: [profile.id],
  };
}

function mixSeed(seed: number): number {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function varyColour(colour: number, random: () => number): number {
  const red = ((colour >> 16) & 0xff) / 255;
  const green = ((colour >> 8) & 0xff) / 255;
  const blue = (colour & 0xff) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }

  hue = (hue + 1 + (random() - 0.5) * 0.1) % 1;
  saturation = clamp(saturation * (0.88 + random() * 0.24), 0.3, 1);
  const variedLightness = clamp(lightness * (0.88 + random() * 0.24), 0.12, 0.88);
  const chroma = (1 - Math.abs(2 * variedLightness - 1)) * saturation;
  const sector = hue * 6;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = variedLightness - chroma / 2;
  let channels: [number, number, number];
  if (sector < 1) channels = [chroma, secondary, 0];
  else if (sector < 2) channels = [secondary, chroma, 0];
  else if (sector < 3) channels = [0, chroma, secondary];
  else if (sector < 4) channels = [0, secondary, chroma];
  else if (sector < 5) channels = [secondary, 0, chroma];
  else channels = [chroma, 0, secondary];
  const [outRed, outGreen, outBlue] = channels.map((channel) => Math.round((channel + offset) * 255));
  return (outRed << 16) | (outGreen << 8) | outBlue;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
