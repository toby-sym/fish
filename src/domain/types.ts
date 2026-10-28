export type FishSex = "female" | "male" | "unknown";
export type LifeStage = "juvenile" | "adult";
export type FishPattern = "solid" | "stripe" | "mottled" | "speckled" | "banded" | "marbled";
export type FishBodyShape = "streamlined" | "deep" | "disc" | "elongated";
export type FishTailShape = "fan" | "forked" | "lyre" | "veil" | "sword";
export type PlantGrowthForm = "fern" | "broad-leaf" | "stem" | "ribbon" | "rosette" | "floating";
export type CompatibilityGroup = "poecilia" | "xiphophorus" | "tetra" | "danio" | "rasbora" | "barb" | "labyrinth" | "catfish" | "cichlid";

export interface FishVisualTraits {
  bodyShape?: FishBodyShape;
  tailShape?: FishTailShape;
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
  schooling?: boolean;
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
  growthForm?: PlantGrowthForm;
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
