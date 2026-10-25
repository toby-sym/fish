import { Fish } from "./entities";
import { Tank } from "./tank";
import type { SpeciesProfile } from "./types";

const STEP_SECONDS = 1;
const MAX_FRAME_DELTA_SECONDS = 0.25;

export class EcosystemSimulation {
  private accumulatorSeconds = 0;

  advance(tank: Tank, profiles: Map<string, SpeciesProfile>, elapsedSeconds: number): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    this.accumulatorSeconds += Math.min(elapsedSeconds, MAX_FRAME_DELTA_SECONDS);

    while (this.accumulatorSeconds >= STEP_SECONDS) {
      this.step(tank, profiles, STEP_SECONDS);
      this.accumulatorSeconds -= STEP_SECONDS;
    }
  }

  resetClock(): void {
    this.accumulatorSeconds = 0;
  }

  private step(tank: Tank, profiles: Map<string, SpeciesProfile>, deltaSeconds: number): void {
    const minutes = deltaSeconds / 60;
    const fishWaste = tank.fish.reduce((total, fish) => {
      const profile = profiles.get(fish.genome.lineageSpeciesIds[0] ?? fish.speciesId);
      return total + (profile?.wastePerMinute ?? 0.004);
    }, 0);
    const invertebrateWaste = tank.invertebrates.reduce((total, item) => total + item.wastePerMinute, 0);

    // Starter rule set: replace these coefficients with tuned ecosystem curves in a later slice.
    tank.chemistry.ammoniaMgL += (fishWaste + invertebrateWaste + tank.uneatenFood * 0.02) * minutes;
    tank.uneatenFood = Math.max(0, tank.uneatenFood - 0.04 * minutes);
    tank.detritus += (tank.fish.length * 0.001 + invertebrateWaste * 0.2) * minutes;
    tank.detritus = Math.max(0, tank.detritus - tank.invertebrates.reduce(
      (total, item) => total + item.detritusConsumptionPerMinute,
      0,
    ) * minutes);

    const filterEfficiency = (tank.filterCondition / 100) * (tank.bacteriaLevel / 100);
    const ammoniaConverted = Math.min(tank.chemistry.ammoniaMgL, 0.035 * filterEfficiency * minutes);
    tank.chemistry.ammoniaMgL -= ammoniaConverted;
    tank.chemistry.nitriteMgL += ammoniaConverted;

    const nitriteConverted = Math.min(tank.chemistry.nitriteMgL, 0.04 * filterEfficiency * minutes);
    tank.chemistry.nitriteMgL -= nitriteConverted;
    tank.chemistry.nitrateMgL += nitriteConverted;

    const nitrateUptake = tank.plants.reduce((total, plant) => total + plant.nitrateUptakePerMinute, 0) * minutes;
    tank.chemistry.nitrateMgL = Math.max(0, tank.chemistry.nitrateMgL - nitrateUptake);
    const oxygenProduction = tank.plants.reduce((total, plant) => total + plant.oxygenProductionPerMinute, 0);
    const oxygenUse = tank.fish.length * 0.006
      + tank.invertebrates.reduce((total, item) => total + item.oxygenConsumptionPerMinute, 0);
    tank.chemistry.dissolvedOxygenMgL = clamp(
      tank.chemistry.dissolvedOxygenMgL + (oxygenProduction - oxygenUse + 0.015 * filterEfficiency) * minutes,
      0,
      12,
    );

    for (const fish of tank.fish) {
      fish.ageMinutes += minutes;
      fish.hunger = clamp(fish.hunger + 0.35 * minutes, 0, 100);
      if (fish.ageMinutes >= 30) fish.lifeStage = "adult";
      this.updateFishHealth(fish, tank, profiles);
    }

    tank.bacteriaLevel = clamp(tank.bacteriaLevel + (tank.filterCondition > 20 ? 0.002 : -0.01) * minutes, 0, 100);
    tank.chemistry.ammoniaMgL = clamp(tank.chemistry.ammoniaMgL, 0, 10);
    tank.chemistry.nitriteMgL = clamp(tank.chemistry.nitriteMgL, 0, 10);
    tank.chemistry.nitrateMgL = clamp(tank.chemistry.nitrateMgL, 0, 200);
  }

  private updateFishHealth(fish: Fish, tank: Tank, profiles: Map<string, SpeciesProfile>): void {
    const profile = profiles.get(fish.genome.lineageSpeciesIds[0] ?? fish.speciesId);
    if (!profile) return;
    const water = tank.chemistry;
    const needs = profile.waterNeeds;
    const withinRange = water.temperatureC >= needs.temperatureMinC
      && water.temperatureC <= needs.temperatureMaxC
      && water.pH >= needs.pHMin
      && water.pH <= needs.pHMax
      && water.ammoniaMgL <= needs.ammoniaMaxMgL
      && water.nitriteMgL <= needs.nitriteMaxMgL
      && water.nitrateMgL <= needs.nitrateMaxMgL
      && water.dissolvedOxygenMgL >= needs.oxygenMinMgL;

    fish.health = clamp(fish.health + (withinRange ? 0.012 : -0.035), 0, 100);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
