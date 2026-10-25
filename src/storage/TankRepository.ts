import { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { Tank, WaterChemistry } from "../domain/tank";
import type { FishGenome, Vec3Data } from "../domain/types";

const DATABASE_NAME = "aquarium-wallpaper";
const DATABASE_VERSION = 1;
const STORE_NAME = "tank-records";
const ACTIVE_TANK_KEY = "active";

interface StoredFish {
  id: string;
  name: string;
  speciesId: string;
  speciesName: string;
  compatibilityGroup: string;
  genome: FishGenome;
  sex: "female" | "male" | "unknown";
  lifeStage: "juvenile" | "adult";
  health: number;
  hunger: number;
  ageMinutes: number;
  parentIds: string[];
  parentSpeciesIds: string[];
}

interface StoredPlant {
  id: string;
  name: string;
  speciesId: string;
  nitrateUptakePerMinute: number;
  oxygenProductionPerMinute: number;
  visualSeed: number;
  colour: number;
  position: Vec3Data;
  health: number;
}

interface StoredInvertebrate {
  id: string;
  name: string;
  speciesId: string;
  detritusConsumptionPerMinute: number;
  wastePerMinute: number;
  oxygenConsumptionPerMinute: number;
  colour: number;
  position: Vec3Data;
  health: number;
}

interface TankSnapshot {
  id: string;
  name: string;
  fish: StoredFish[];
  plants: StoredPlant[];
  invertebrates: StoredInvertebrate[];
  chemistry: {
    temperatureC: number;
    pH: number;
    ammoniaMgL: number;
    nitriteMgL: number;
    nitrateMgL: number;
    dissolvedOxygenMgL: number;
  };
  bacteriaLevel: number;
  filterCondition: number;
  uneatenFood: number;
  detritus: number;
}

interface TankRecord {
  schemaVersion: number;
  savedAt: number;
  tank: TankSnapshot;
}

/** Versioned IndexedDB persistence for a single desktop wallpaper tank. */
export class TankRepository {
  private databasePromise?: Promise<IDBDatabase>;

  async load(): Promise<Tank | undefined> {
    const record = await this.request<TankRecord | undefined>("readonly", (store) => store.get(ACTIVE_TANK_KEY));
    if (!record) return undefined;
    if (record.schemaVersion !== DATABASE_VERSION) {
      console.warn(`Ignoring aquarium save schema ${record.schemaVersion}; expected ${DATABASE_VERSION}.`);
      return undefined;
    }
    return this.hydrate(record.tank);
  }

  async save(tank: Tank): Promise<void> {
    const record: TankRecord = {
      schemaVersion: DATABASE_VERSION,
      savedAt: Date.now(),
      tank: this.snapshot(tank),
    };
    await this.request("readwrite", (store) => store.put(record, ACTIVE_TANK_KEY));
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close());
    this.databasePromise = undefined;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable in this wallpaper runtime."));

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open the aquarium save database."));
      request.onblocked = () => reject(new Error("Aquarium save database upgrade is blocked by another wallpaper instance."));
    });
    this.databasePromise.catch(() => { this.databasePromise = undefined; });
    return this.databasePromise;
  }

  private async request<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("Aquarium save request failed."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Aquarium save transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Aquarium save transaction was aborted."));
    });
  }

  private snapshot(tank: Tank): TankSnapshot {
    return {
      id: tank.id,
      name: tank.name,
      fish: tank.fish.map((fish) => ({
        id: fish.id,
        name: fish.name,
        speciesId: fish.speciesId,
        speciesName: fish.speciesName,
        compatibilityGroup: fish.compatibilityGroup,
        genome: fish.genome,
        sex: fish.sex,
        lifeStage: fish.lifeStage,
        health: fish.health,
        hunger: fish.hunger,
        ageMinutes: fish.ageMinutes,
        parentIds: fish.parentIds,
        parentSpeciesIds: fish.parentSpeciesIds,
      })),
      plants: tank.plants.map((plant) => ({
        id: plant.id,
        name: plant.name,
        speciesId: plant.speciesId,
        nitrateUptakePerMinute: plant.nitrateUptakePerMinute,
        oxygenProductionPerMinute: plant.oxygenProductionPerMinute,
        visualSeed: plant.visualSeed,
        colour: plant.colour,
        position: plant.position,
        health: plant.health,
      })),
      invertebrates: tank.invertebrates.map((item) => ({
        id: item.id,
        name: item.name,
        speciesId: item.speciesId,
        detritusConsumptionPerMinute: item.detritusConsumptionPerMinute,
        wastePerMinute: item.wastePerMinute,
        oxygenConsumptionPerMinute: item.oxygenConsumptionPerMinute,
        colour: item.colour,
        position: item.position,
        health: item.health,
      })),
      chemistry: {
        temperatureC: tank.chemistry.temperatureC,
        pH: tank.chemistry.pH,
        ammoniaMgL: tank.chemistry.ammoniaMgL,
        nitriteMgL: tank.chemistry.nitriteMgL,
        nitrateMgL: tank.chemistry.nitrateMgL,
        dissolvedOxygenMgL: tank.chemistry.dissolvedOxygenMgL,
      },
      bacteriaLevel: tank.bacteriaLevel,
      filterCondition: tank.filterCondition,
      uneatenFood: tank.uneatenFood,
      detritus: tank.detritus,
    };
  }

  private hydrate(snapshot: TankSnapshot): Tank {
    const fish = snapshot.fish.map((stored) => new Fish(stored));
    const plants = snapshot.plants.map((stored) => new Plant(stored));
    const invertebrates = snapshot.invertebrates.map((stored) => new AquaticInvertebrate(stored));
    return new Tank({
      ...snapshot,
      fish,
      plants,
      invertebrates,
      chemistry: Object.assign(new WaterChemistry(), snapshot.chemistry),
    });
  }
}
