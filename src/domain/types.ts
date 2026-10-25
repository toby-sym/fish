export type FishSex = "female" | "male" | "unknown";
export type LifeStage = "juvenile" | "adult";
export type FishPattern = "solid" | "stripe" | "mottled";
export type CompatibilityGroup = "poecilia" | "xiphophorus";

export interface FishVisualTraits {
  bodyLength: number;
  bodyHeight: number;
  bodyDepth: number;
  tailSize: number;
  dorsalFinSize: number;
  pattern: FishPattern;
  primaryColour: number;
  secondaryColour: number;
  accentColour: number;
  seed: number;
}

export type SpeciesVisualProfile = Omit<FishVisualTraits, "seed">;

export interface WaterNeeds {
  temperatureMinC: number;
  temperatureMaxC: number;
  pHMin: number;
  pHMax: number;
  ammoniaMaxMgL: number;
  nitriteMaxMgL: number;
  nitrateMaxMgL: number;
  oxygenMinMgL: number;
}

export interface SpeciesProfile {
  id: string;
  commonName: string;
  familyName: string;
  compatibilityGroup: CompatibilityGroup;
  waterNeeds: WaterNeeds;
  visual: SpeciesVisualProfile;
  wastePerMinute: number;
}

export interface PlantProfile {
  id: string;
  commonName: string;
  nitrateUptakePerMinute: number;
  oxygenProductionPerMinute: number;
  visualSeed: number;
  colour: number;
}

export interface InvertebrateProfile {
  id: string;
  commonName: string;
  detritusConsumptionPerMinute: number;
  wastePerMinute: number;
  oxygenConsumptionPerMinute: number;
  colour: number;
}

export interface FishGenome {
  visual: FishVisualTraits;
  lineageSpeciesIds: string[];
}

export interface Vec3Data {
  x: number;
  y: number;
  z: number;
}

export function createId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${prefix}-${randomId}`;

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
