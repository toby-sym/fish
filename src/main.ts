import "./style.css";
import { AquaticInvertebrate, Fish, Plant } from "./domain/entities";
import { BreedingSystem } from "./domain/breeding";
import { EcosystemSimulation } from "./domain/simulation";
import { createGenome } from "./domain/random";
import type { Tank } from "./domain/tank";
import { TankRepository } from "./storage/TankRepository";
import { invertebrateProfiles, plantProfiles, speciesById, speciesProfiles } from "./data/profiles";
import { createStarterTank } from "./data/starterTank";
import { AquariumRenderer } from "./rendering/AquariumRenderer";

declare global {
  interface Window {
    livelyWallpaperPlaybackChanged?: (data: unknown) => void;
  }
}

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing aquarium UI element: #${id}`);
  return element as T;
};

const canvas = byId<HTMLCanvasElement>("aquarium-canvas");
const panel = byId<HTMLElement>("control-panel");
const toggleButton = byId<HTMLButtonElement>("panel-toggle");
const fishSelect = byId<HTMLSelectElement>("fish-select");
const fishName = byId<HTMLInputElement>("fish-name");
const fishDetails = byId<HTMLElement>("fish-details");
const saveStatus = byId<HTMLElement>("save-status");
const toast = byId<HTMLElement>("toast");
const waterReadings = byId<HTMLElement>("water-readings");
const supportList = byId<HTMLUListElement>("support-list");
const simulation = new EcosystemSimulation();
const breeding = new BreedingSystem();
const repository = new TankRepository();
const renderer = new AquariumRenderer(canvas);
let tank: Tank | undefined;
let selectedFishId: string | null = null;
let hostPaused = false;
let saveInProgress = false;
let saveRequested = false;
let lastSaveTime = 0;
let lastUiTime = 0;
let toastTimer = 0;

populateOptions(byId<HTMLSelectElement>("new-fish-species"), speciesProfiles.map((profile) => [profile.id, profile.commonName]));
populateOptions(byId<HTMLSelectElement>("new-plant-species"), plantProfiles.map((profile) => [profile.id, profile.commonName]));
populateOptions(byId<HTMLSelectElement>("new-invertebrate-species"), invertebrateProfiles.map((profile) => [profile.id, profile.commonName]));

function populateOptions(select: HTMLSelectElement, entries: Array<[string, string]>): void {
  select.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
}

function setStatus(message: string): void {
  saveStatus.textContent = message;
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

function requireTank(): Tank {
  if (!tank) throw new Error("The tank is still loading.");
  return tank;
}

function selectedFish(): Fish | undefined {
  return tank?.fish.find((fish) => fish.id === selectedFishId);
}

function selectFish(id: string | null): void {
  selectedFishId = id;
  fishSelect.value = id ?? "";
  renderer.setSelectedFish(id);
  refreshFishDetails();
}

function refreshFishOptions(): void {
  if (!tank) return;
  const previousSelection = selectedFishId;
  fishSelect.replaceChildren(new Option("Select a fish…", ""));
  for (const fish of tank.fish) {
    fishSelect.add(new Option(`${fish.name} · ${fish.speciesName}`, fish.id));
  }
  const current = tank.fish.some((fish) => fish.id === previousSelection) ? previousSelection : tank.fish[0]?.id ?? null;
  selectFish(current);
  byId<HTMLElement>("fish-count").textContent = String(tank.fish.length);
  refreshParentOptions();
}

function refreshParentOptions(): void {
  if (!tank) return;
  const females = tank.fish.filter((fish) => fish.sex === "female" && fish.lifeStage === "adult");
  const adultMales = tank.fish.filter((fish) => fish.sex === "male" && fish.lifeStage === "adult");
  const femaleSelect = byId<HTMLSelectElement>("parent-a");
  const maleSelect = byId<HTMLSelectElement>("parent-b");
  const priorFemale = femaleSelect.value;
  const priorMale = maleSelect.value;
  populateOptions(femaleSelect, females.map((fish) => [fish.id, `${fish.name} · ${fish.speciesName}`]));
  const selectedFemale = females.find((fish) => fish.id === priorFemale) ?? females[0];
  femaleSelect.value = selectedFemale?.id ?? "";
  const compatibleMales = selectedFemale
    ? adultMales.filter((fish) => fish.compatibilityGroup === selectedFemale.compatibilityGroup)
    : [];
  populateOptions(maleSelect, compatibleMales.map((fish) => [fish.id, `${fish.name} · ${fish.speciesName}`]));
  maleSelect.value = compatibleMales.some((fish) => fish.id === priorMale)
    ? priorMale
    : compatibleMales[0]?.id ?? "";
  refreshBreedingAvailability();
}

function refreshBreedingAvailability(): void {
  const female = tank?.fish.find((fish) => fish.id === byId<HTMLSelectElement>("parent-a").value);
  const male = tank?.fish.find((fish) => fish.id === byId<HTMLSelectElement>("parent-b").value);
  const available = Boolean(female && male && breeding.canBreed(female, male));
  byId<HTMLButtonElement>("breed-fish").disabled = !available;

  const status = byId<HTMLElement>("breeding-status");
  if (available) {
    status.textContent = "Healthy compatible pair ready.";
  } else if (!female || !male) {
    status.textContent = "Add an adult female and male from a compatible group.";
  } else {
    status.textContent = "Both fish need at least 55% health to breed.";
  }
}

function refreshFishDetails(): void {
  const fish = selectedFish();
  byId<HTMLButtonElement>("feed-fish").disabled = !fish;
  byId<HTMLButtonElement>("remove-fish").disabled = !fish;
  byId<HTMLButtonElement>("rename-fish").disabled = !fish;
  fishName.disabled = !fish;
  if (!fish) {
    fishName.value = "";
    fishDetails.textContent = "Add a fish or click one in the tank to inspect it.";
    return;
  }
  if (document.activeElement !== fishName) fishName.value = fish.name;
  const sex = fish.sex === "unknown" ? "unknown sex" : fish.sex;
  fishDetails.textContent = `${fish.speciesName} · ${sex} · health ${Math.round(fish.health)}% · hunger ${Math.round(fish.hunger)}%`;
  refreshBreedingAvailability();
}

function refreshReadings(): void {
  if (!tank) return;
  const chemistry = tank.chemistry;
  const readings: Array<[string, string, string]> = [
    ["Temperature", `${chemistry.temperatureC.toFixed(1)}°`, "C"],
    ["pH", chemistry.pH.toFixed(2), ""],
    ["Ammonia", chemistry.ammoniaMgL.toFixed(3), "mg/L"],
    ["Nitrite", chemistry.nitriteMgL.toFixed(3), "mg/L"],
    ["Nitrate", chemistry.nitrateMgL.toFixed(1), "mg/L"],
    ["Oxygen", chemistry.dissolvedOxygenMgL.toFixed(1), "mg/L"],
  ];
  waterReadings.replaceChildren(...readings.map(([label, value, unit]) => {
    const item = document.createElement("div");
    item.className = "reading";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = `${value}${unit ? ` ${unit}` : ""}`;
    item.append(term, description);
    return item;
  }));
  byId<HTMLElement>("filter-reading").textContent = `${Math.round(tank.filterCondition)}%`;
  byId<HTMLElement>("detritus-reading").textContent = tank.detritus.toFixed(2);
}

function refreshSupportList(): void {
  if (!tank) return;
  const entries = [
    ...tank.plants.map((plant) => ({ id: plant.id, label: plant.name, type: "plant" as const })),
    ...tank.invertebrates.map((item) => ({ id: item.id, label: item.name, type: "invertebrate" as const })),
  ];
  supportList.replaceChildren(...entries.map((entry) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = entry.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-organism";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${entry.label}`);
    remove.addEventListener("click", () => {
      const currentTank = requireTank();
      if (entry.type === "plant") currentTank.removePlant(entry.id);
      else currentTank.removeInvertebrate(entry.id);
      refreshAll();
      saveTank();
    });
    item.append(label, remove);
    return item;
  }));
}

function refreshAll(): void {
  refreshFishOptions();
  refreshFishDetails();
  refreshReadings();
  refreshSupportList();
  byId<HTMLElement>("ecosystem-summary").textContent = `${tank?.plants.length ?? 0} plants · ${tank?.invertebrates.length ?? 0} invertebrates supporting ${tank?.fish.length ?? 0} fish.`;
}

function commitChange(message: string): void {
  refreshAll();
  void saveTank();
  showToast(message);
}

async function saveTank(): Promise<void> {
  if (!tank) return;
  if (saveInProgress) {
    saveRequested = true;
    return;
  }
  saveInProgress = true;
  try {
    await repository.save(tank);
    lastSaveTime = performance.now();
    setStatus("Saved in this wallpaper");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown storage error";
    setStatus("Save unavailable · WebView2 required");
    console.warn("Could not save aquarium state:", detail);
  } finally {
    saveInProgress = false;
    if (saveRequested) {
      saveRequested = false;
      void saveTank();
    }
  }
}

function randomPosition(): { x: number; y: number; z: number } {
  return { x: (Math.random() - 0.5) * 15, y: 0, z: (Math.random() - 0.5) * 2.6 };
}

function addFish(speciesId: string): void {
  const profile = speciesById.get(speciesId);
  if (!profile) throw new Error("Choose a fish species first.");
  const currentTank = requireTank();
  const seed = Math.floor(Math.random() * 0xffffffff);
  const ordinal = currentTank.fish.length + 1;
  const fish = new Fish({
    name: `${profile.commonName} ${ordinal}`,
    speciesId: profile.id,
    speciesName: profile.commonName,
    compatibilityGroup: profile.compatibilityGroup,
    genome: createGenome(profile, seed),
    sex: Math.random() < 0.5 ? "female" : "male",
    lifeStage: "adult",
  });
  currentTank.addFish(fish);
  selectedFishId = fish.id;
  commitChange(`${fish.name} joined the habitat.`);
}

function addPlant(speciesId: string): void {
  const profile = plantProfiles.find((item) => item.id === speciesId);
  if (!profile) throw new Error("Choose a plant first.");
  const plant = new Plant({
    name: profile.commonName,
    speciesId: profile.id,
    nitrateUptakePerMinute: profile.nitrateUptakePerMinute,
    oxygenProductionPerMinute: profile.oxygenProductionPerMinute,
    visualSeed: profile.visualSeed + Math.floor(Math.random() * 10000),
    colour: profile.colour,
    growthForm: profile.growthForm,
    position: randomPosition(),
  });
  requireTank().addPlant(plant);
  commitChange(`${plant.name} was planted.`);
}

function addInvertebrate(speciesId: string): void {
  const profile = invertebrateProfiles.find((item) => item.id === speciesId);
  if (!profile) throw new Error("Choose an invertebrate first.");
  const ordinal = requireTank().invertebrates.filter((item) => item.speciesId === profile.id).length + 1;
  const item = new AquaticInvertebrate({
    name: `${profile.commonName} ${ordinal}`,
    speciesId: profile.id,
    detritusConsumptionPerMinute: profile.detritusConsumptionPerMinute,
    wastePerMinute: profile.wastePerMinute,
    oxygenConsumptionPerMinute: profile.oxygenConsumptionPerMinute,
    colour: profile.colour,
    position: randomPosition(),
  });
  requireTank().addInvertebrate(item);
  commitChange(`${item.name} joined the habitat.`);
}

function perform(action: () => void): void {
  try {
    action();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "That action could not be completed.");
  }
}

byId<HTMLButtonElement>("panel-toggle").addEventListener("click", () => {
  panel.hidden = false;
  toggleButton.hidden = true;
  toggleButton.setAttribute("aria-expanded", "true");
});
byId<HTMLButtonElement>("panel-close").addEventListener("click", () => {
  panel.hidden = true;
  toggleButton.hidden = false;
  toggleButton.setAttribute("aria-expanded", "false");
});
fishSelect.addEventListener("change", () => selectFish(fishSelect.value || null));
byId<HTMLSelectElement>("parent-a").addEventListener("change", refreshParentOptions);
byId<HTMLSelectElement>("parent-b").addEventListener("change", refreshBreedingAvailability);
byId<HTMLButtonElement>("rename-fish").addEventListener("click", () => perform(() => {
  const fish = selectedFish();
  if (!fish) return;
  requireTank().renameFish(fish.id, fishName.value);
  commitChange(`${fish.name} has a new name.`);
}));
fishName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") byId<HTMLButtonElement>("rename-fish").click();
});
byId<HTMLButtonElement>("feed-fish").addEventListener("click", () => perform(() => {
  const fish = selectedFish();
  if (!fish) return;
  requireTank().feedFish(fish.id);
  renderer.triggerFeeding(fish.id);
  commitChange(`${fish.name} enjoyed a snack.`);
}));
byId<HTMLButtonElement>("remove-fish").addEventListener("click", () => perform(() => {
  const fish = selectedFish();
  if (!fish) return;
  requireTank().removeFish(fish.id);
  selectedFishId = null;
  commitChange(`${fish.name} left the habitat.`);
}));
byId<HTMLButtonElement>("add-fish").addEventListener("click", () => perform(() => addFish(byId<HTMLSelectElement>("new-fish-species").value)));
byId<HTMLButtonElement>("add-plant").addEventListener("click", () => perform(() => addPlant(byId<HTMLSelectElement>("new-plant-species").value)));
byId<HTMLButtonElement>("add-invertebrate").addEventListener("click", () => perform(() => addInvertebrate(byId<HTMLSelectElement>("new-invertebrate-species").value)));
byId<HTMLButtonElement>("water-change").addEventListener("click", () => {
  requireTank().waterChange(0.25);
  commitChange("A quarter of the tank water was refreshed.");
});
byId<HTMLButtonElement>("breed-fish").addEventListener("click", () => perform(() => {
  const female = requireTank().fish.find((fish) => fish.id === byId<HTMLSelectElement>("parent-a").value);
  const male = requireTank().fish.find((fish) => fish.id === byId<HTMLSelectElement>("parent-b").value);
  if (!female || !male) throw new Error("Choose an adult female and male first.");
  const offspring = breeding.createOffspring(female, male, speciesById, Date.now() >>> 0);
  requireTank().addFish(offspring);
  selectedFishId = offspring.id;
  commitChange(`${offspring.speciesName} was born.`);
}));

function updatePlayback(): void {
  const shouldPause = document.visibilityState !== "visible" || hostPaused;
  if (shouldPause) {
    renderer.pause();
    simulation.resetClock();
    return;
  }
  renderer.resume();
}

function playbackIsPaused(data: unknown): boolean | undefined {
  if (typeof data === "boolean") return data;
  if (typeof data === "string") {
    const state = data.toLowerCase();
    if (state.startsWith("{") || state.startsWith("[")) {
      try {
        return playbackIsPaused(JSON.parse(data) as unknown);
      } catch {
        // Lively sometimes sends plain strings; those are interpreted below.
      }
    }
    if (state.includes("pause") || state.includes("stop")) return true;
    if (state.includes("play") || state.includes("resume")) return false;
    return undefined;
  }
  if (!data || typeof data !== "object") return undefined;
  const value = data as Record<string, unknown>;
  if (typeof value.isPaused === "boolean") return value.isPaused;
  if (typeof value.IsPaused === "boolean") return value.IsPaused;
  if (typeof value.paused === "boolean") return value.paused;
  if (typeof value.isPlaying === "boolean") return !value.isPlaying;
  for (const key of ["playbackState", "state"]) {
    if (typeof value[key] === "string") return playbackIsPaused(value[key]);
  }
  return undefined;
}

window.livelyWallpaperPlaybackChanged = (data) => {
  const paused = playbackIsPaused(data);
  if (paused !== undefined) {
    hostPaused = paused;
    updatePlayback();
  }
};
document.addEventListener("visibilitychange", updatePlayback);
window.addEventListener("pagehide", () => {
  renderer.pause();
  simulation.resetClock();
  void saveTank();
});

async function start(): Promise<void> {
  try {
    tank = await repository.load();
    setStatus(tank ? "Restored your saved habitat" : "A new habitat is ready");
  } catch (error) {
    tank = undefined;
    const detail = error instanceof Error ? error.message : "Storage unavailable";
    console.warn("Could not load aquarium save:", detail);
    setStatus("Local saves need Lively WebView2");
  }
  tank ??= createStarterTank();
  refreshAll();
  renderer.start(
    () => requireTank(),
    (deltaSeconds) => {
      const currentTank = requireTank();
      simulation.advance(currentTank, speciesById, deltaSeconds);
      const now = performance.now();
      if (now - lastUiTime >= 1000) {
        refreshFishDetails();
        refreshReadings();
        lastUiTime = now;
      }
      if (now - lastSaveTime >= 20000 && !saveInProgress) void saveTank();
    },
    selectFish,
  );
  updatePlayback();
  if (!lastSaveTime && tank) void saveTank();
}

void start();
