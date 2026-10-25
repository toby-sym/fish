import type { InvertebrateProfile, PlantProfile, SpeciesProfile } from "../domain/types";

const freshwaterNeeds = {
  temperatureMinC: 22,
  temperatureMaxC: 28,
  pHMin: 6.5,
  pHMax: 8.2,
  ammoniaMaxMgL: 0.15,
  nitriteMaxMgL: 0.2,
  nitrateMaxMgL: 40,
  oxygenMinMgL: 5.5,
};

export const speciesProfiles: SpeciesProfile[] = [
  {
    id: "guppy",
    commonName: "Guppy",
    familyName: "Poecilia reticulata",
    compatibilityGroup: "poecilia",
    waterNeeds: freshwaterNeeds,
    visual: {
      bodyLength: 1.15,
      bodyHeight: 0.43,
      bodyDepth: 0.31,
      tailSize: 0.7,
      dorsalFinSize: 0.28,
      pattern: "mottled",
      primaryColour: 0x2d7180,
      secondaryColour: 0xf0a34c,
      accentColour: 0x54c5b3,
    },
    wastePerMinute: 0.004,
  },
  {
    id: "endler",
    commonName: "Endler's livebearer",
    familyName: "Poecilia wingei",
    compatibilityGroup: "poecilia",
    waterNeeds: freshwaterNeeds,
    visual: {
      bodyLength: 0.94,
      bodyHeight: 0.37,
      bodyDepth: 0.27,
      tailSize: 0.48,
      dorsalFinSize: 0.22,
      pattern: "stripe",
      primaryColour: 0x275c70,
      secondaryColour: 0xf1ce64,
      accentColour: 0xef795d,
    },
    wastePerMinute: 0.003,
  },
  {
    id: "platy",
    commonName: "Platy",
    familyName: "Xiphophorus maculatus",
    compatibilityGroup: "xiphophorus",
    waterNeeds: { ...freshwaterNeeds, temperatureMinC: 21, temperatureMaxC: 27 },
    visual: {
      bodyLength: 1.08,
      bodyHeight: 0.55,
      bodyDepth: 0.37,
      tailSize: 0.52,
      dorsalFinSize: 0.3,
      pattern: "mottled",
      primaryColour: 0x55846a,
      secondaryColour: 0xe6a65d,
      accentColour: 0xe5674e,
    },
    wastePerMinute: 0.004,
  },
  {
    id: "swordtail",
    commonName: "Swordtail",
    familyName: "Xiphophorus hellerii",
    compatibilityGroup: "xiphophorus",
    waterNeeds: { ...freshwaterNeeds, temperatureMinC: 22, temperatureMaxC: 28 },
    visual: {
      bodyLength: 1.3,
      bodyHeight: 0.47,
      bodyDepth: 0.32,
      tailSize: 0.58,
      dorsalFinSize: 0.36,
      pattern: "stripe",
      primaryColour: 0x397b70,
      secondaryColour: 0x9fc56b,
      accentColour: 0xe9c76a,
    },
    wastePerMinute: 0.005,
  },
];

export const plantProfiles: PlantProfile[] = [
  { id: "java-fern", commonName: "Java fern", nitrateUptakePerMinute: 0.012, oxygenProductionPerMinute: 0.008, visualSeed: 104, colour: 0x4a966c },
  { id: "anubias", commonName: "Anubias", nitrateUptakePerMinute: 0.009, oxygenProductionPerMinute: 0.006, visualSeed: 208, colour: 0x6ba16a },
  { id: "hornwort", commonName: "Hornwort", nitrateUptakePerMinute: 0.018, oxygenProductionPerMinute: 0.012, visualSeed: 312, colour: 0x3f8b63 },
];

export const invertebrateProfiles: InvertebrateProfile[] = [
  { id: "nerite-snail", commonName: "Nerite snail", detritusConsumptionPerMinute: 0.015, wastePerMinute: 0.001, oxygenConsumptionPerMinute: 0.002, colour: 0xe2b464 },
  { id: "freshwater-shrimp", commonName: "Freshwater shrimp", detritusConsumptionPerMinute: 0.012, wastePerMinute: 0.001, oxygenConsumptionPerMinute: 0.002, colour: 0xe58a75 },
];

export const speciesById = new Map(speciesProfiles.map((profile) => [profile.id, profile]));
export const plantsById = new Map(plantProfiles.map((profile) => [profile.id, profile]));
export const invertebratesById = new Map(invertebrateProfiles.map((profile) => [profile.id, profile]));
