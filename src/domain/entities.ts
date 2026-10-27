import { createId } from "./types";
import type { FishGenome, FishSex, LifeStage, PlantGrowthForm, Vec3Data } from "./types";

export abstract class AquaticOrganism {
  readonly id: string;
  name: string;
  health: number;

  protected constructor(name: string, health = 100, id = createId("organism")) {
    this.id = id;
    this.name = name;
    this.health = clamp(health, 0, 100);
  }
}

export interface FishInit {
  name: string;
  speciesId: string;
  speciesName: string;
  compatibilityGroup: string;
  genome: FishGenome;
  sex?: FishSex;
  lifeStage?: LifeStage;
  health?: number;
  hunger?: number;
  ageMinutes?: number;
  parentIds?: string[];
  parentSpeciesIds?: string[];
  id?: string;
}

export class Fish extends AquaticOrganism {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly compatibilityGroup: string;
  readonly genome: FishGenome;
  readonly sex: FishSex;
  readonly parentIds: string[];
  readonly parentSpeciesIds: string[];
  lifeStage: LifeStage;
  hunger: number;
  ageMinutes: number;

  constructor(init: FishInit) {
    super(init.name, init.health, init.id ?? createId("fish"));
    this.speciesId = init.speciesId;
    this.speciesName = init.speciesName;
    this.compatibilityGroup = init.compatibilityGroup;
    this.genome = structuredClone(init.genome);
    this.sex = init.sex ?? "unknown";
    this.lifeStage = init.lifeStage ?? "adult";
    this.hunger = clamp(init.hunger ?? 12, 0, 100);
    this.ageMinutes = Math.max(0, init.ageMinutes ?? 0);
    this.parentIds = [...(init.parentIds ?? [])];
    this.parentSpeciesIds = [...(init.parentSpeciesIds ?? [init.speciesId])];
  }
}

export interface PlantInit {
  name: string;
  speciesId: string;
  nitrateUptakePerMinute: number;
  oxygenProductionPerMinute: number;
  visualSeed: number;
  colour: number;
  growthForm?: PlantGrowthForm;
  position?: Vec3Data;
  health?: number;
  id?: string;
}

export class Plant extends AquaticOrganism {
  readonly speciesId: string;
  readonly nitrateUptakePerMinute: number;
  readonly oxygenProductionPerMinute: number;
  readonly visualSeed: number;
  readonly colour: number;
  readonly growthForm: PlantGrowthForm;
  position: Vec3Data;

  constructor(init: PlantInit) {
    super(init.name, init.health, init.id ?? createId("plant"));
    this.speciesId = init.speciesId;
    this.nitrateUptakePerMinute = init.nitrateUptakePerMinute;
    this.oxygenProductionPerMinute = init.oxygenProductionPerMinute;
    this.visualSeed = init.visualSeed;
    this.colour = init.colour;
    this.growthForm = init.growthForm ?? "fern";
    this.position = { ...(init.position ?? { x: 0, y: 0, z: 0 }) };
  }
}

export interface InvertebrateInit {
  name: string;
  speciesId: string;
  detritusConsumptionPerMinute: number;
  wastePerMinute: number;
  oxygenConsumptionPerMinute: number;
  colour: number;
  position?: Vec3Data;
  health?: number;
  id?: string;
}

export class AquaticInvertebrate extends AquaticOrganism {
  readonly speciesId: string;
  readonly detritusConsumptionPerMinute: number;
  readonly wastePerMinute: number;
  readonly oxygenConsumptionPerMinute: number;
  readonly colour: number;
  position: Vec3Data;

  constructor(init: InvertebrateInit) {
    super(init.name, init.health, init.id ?? createId("invertebrate"));
    this.speciesId = init.speciesId;
    this.detritusConsumptionPerMinute = init.detritusConsumptionPerMinute;
    this.wastePerMinute = init.wastePerMinute;
    this.oxygenConsumptionPerMinute = init.oxygenConsumptionPerMinute;
    this.colour = init.colour;
    this.position = { ...(init.position ?? { x: 0, y: 0, z: 0 }) };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
