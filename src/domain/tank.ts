import { AquaticInvertebrate, Fish, Plant } from "./entities";

export class WaterChemistry {
  temperatureC = 25;
  pH = 7.2;
  ammoniaMgL = 0.02;
  nitriteMgL = 0.01;
  nitrateMgL = 8;
  dissolvedOxygenMgL = 7.2;

  applyWaterChange(fraction: number): void {
    const amount = clamp(fraction, 0, 1);
    this.temperatureC = lerp(this.temperatureC, 24, amount);
    this.pH = lerp(this.pH, 7.2, amount);
    this.ammoniaMgL *= 1 - amount;
    this.nitriteMgL *= 1 - amount;
    this.nitrateMgL *= 1 - amount;
    this.dissolvedOxygenMgL = lerp(this.dissolvedOxygenMgL, 7.4, amount);
  }
}

export class Tank {
  readonly id: string;
  name: string;
  fish: Fish[];
  plants: Plant[];
  invertebrates: AquaticInvertebrate[];
  chemistry: WaterChemistry;
  bacteriaLevel: number;
  filterCondition: number;
  uneatenFood: number;
  detritus: number;

  constructor(init: Partial<Tank> & { id: string; name: string }) {
    this.id = init.id;
    this.name = init.name;
    this.fish = [...(init.fish ?? [])];
    this.plants = [...(init.plants ?? [])];
    this.invertebrates = [...(init.invertebrates ?? [])];
    this.chemistry = Object.assign(new WaterChemistry(), init.chemistry ?? {});
    this.bacteriaLevel = clamp(init.bacteriaLevel ?? 74, 0, 100);
    this.filterCondition = clamp(init.filterCondition ?? 90, 0, 100);
    this.uneatenFood = Math.max(0, init.uneatenFood ?? 0);
    this.detritus = Math.max(0, init.detritus ?? 0);
  }

  addFish(fish: Fish): void {
    if (this.fish.some((item) => item.id === fish.id)) throw new Error("That fish is already in the tank.");
    this.fish.push(fish);
  }

  removeFish(id: string): Fish | undefined {
    const index = this.fish.findIndex((fish) => fish.id === id);
    if (index < 0) return undefined;
    return this.fish.splice(index, 1)[0];
  }

  renameFish(id: string, name: string): void {
    const fish = this.fish.find((item) => item.id === id);
    if (!fish) throw new Error("Fish not found.");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A fish name cannot be empty.");
    fish.name = trimmed.slice(0, 32);
  }

  feedFish(id?: string, hungerRelief = 36): number {
    const targets = id ? this.fish.filter((fish) => fish.id === id) : this.fish;
    if (targets.length === 0) return 0;

    for (const fish of targets) {
      fish.hunger = clamp(fish.hunger - hungerRelief, 0, 100);
      this.uneatenFood += 0.08;
    }
    return targets.length;
  }

  addPlant(plant: Plant): void {
    if (this.plants.some((item) => item.id === plant.id)) throw new Error("That plant is already in the tank.");
    this.plants.push(plant);
  }

  removePlant(id: string): Plant | undefined {
    const index = this.plants.findIndex((plant) => plant.id === id);
    if (index < 0) return undefined;
    return this.plants.splice(index, 1)[0];
  }

  addInvertebrate(invertebrate: AquaticInvertebrate): void {
    if (this.invertebrates.some((item) => item.id === invertebrate.id)) {
      throw new Error("That invertebrate is already in the tank.");
    }
    this.invertebrates.push(invertebrate);
  }

  removeInvertebrate(id: string): AquaticInvertebrate | undefined {
    const index = this.invertebrates.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    return this.invertebrates.splice(index, 1)[0];
  }

  waterChange(fraction = 0.25): void {
    this.chemistry.applyWaterChange(fraction);
    this.detritus *= 1 - clamp(fraction, 0, 1);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
