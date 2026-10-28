import * as THREE from "three";
import { speciesById } from "../data/profiles";
import type { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { seededRandom } from "../domain/random";
import type { Tank } from "../domain/tank";
import { FishMeshFactory } from "./FishMeshFactory";
import { AnimationClock } from "./AnimationClock";
import { feedingSurfaceTarget } from "./FoodMotion";
import { InvertebrateMotion } from "./InvertebrateMotion";
import { FishMotion } from "./FishMotion";
import { PlantMeshFactory } from "./PlantMeshFactory";
import { layoutPlantPositions } from "./PlantLayout";

interface FishActor {
  fish: Fish;
  root: THREE.Group;
  tail: THREE.Group;
  pectoralFins: [THREE.Mesh, THREE.Mesh];
  motion: FishMotion;
  schoolGroup: string | null;
}

interface FoodBurst {
  root: THREE.Group;
  material: THREE.MeshBasicMaterial;
  ageSeconds: number;
  lifetimeSeconds: number;
}

interface InvertebrateActor {
  root: THREE.Group;
  motion: InvertebrateMotion;
  kind: "snail" | "shrimp";
  legs: THREE.Object3D[];
  feelers: THREE.Object3D[];
  phase: number;
}

const FRAME_INTERVAL_MS = 1000 / 30;

export class AquariumRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 60);
  private readonly fishFactory = new FishMeshFactory();
  private readonly animationClock = new AnimationClock();
  private readonly plantFactory = new PlantMeshFactory();
  private readonly foodGeometry = new THREE.CircleGeometry(0.045, 5);
  private readonly fishActors = new Map<string, FishActor>();
  private readonly plantActors = new Map<string, THREE.Group>();
  private readonly invertebrateActors = new Map<string, InvertebrateActor>();
  private readonly foodBursts: FoodBurst[] = [];
  private readonly pendingFeeding = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private getTank?: () => Tank;
  private onFrame?: (deltaSeconds: number) => void;
  private onFishSelected?: (id: string | null) => void;
  private lastFrameTime = 0;
  private selectedFishId: string | null = null;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x20565a, 23, 48);
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);
    this.createLighting();
    this.createTankEnvironment();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.resize();
  }

  start(getTank: () => Tank, onFrame: (deltaSeconds: number) => void, onFishSelected: (id: string | null) => void): void {
    this.getTank = getTank;
    this.onFrame = onFrame;
    this.onFishSelected = onFishSelected;
    this.resume();
  }

  pause(): void {
    this.running = false;
    this.lastFrameTime = 0;
    this.renderer.setAnimationLoop(null);
  }

  resume(): void {
    if (!this.getTank || !this.onFrame || this.running) return;
    this.running = true;
    this.lastFrameTime = 0;
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  setSelectedFish(id: string | null): void {
    this.selectedFishId = id;
  }

  triggerFeeding(fishId: string): void {
    const actor = this.fishActors.get(fishId);
    if (!actor) {
      this.pendingFeeding.add(fishId);
      return;
    }

    const bounds = this.screenBounds(actor.fish.genome.visual.bodyLength + actor.fish.genome.visual.tailSize * 0.5);
    const position = actor.root.position;
    const random = seededRandom(actor.fish.genome.visual.seed ^ Math.floor(performance.now()));
    const target = feedingSurfaceTarget(position, bounds, random);
    actor.motion.feedAt(target, bounds, 8);

    const material = new THREE.MeshBasicMaterial({ color: 0xffca72, transparent: true, opacity: 0.95, depthWrite: false });
    const root = new THREE.Group();
    for (let index = 0; index < 11; index += 1) {
      const crumb = new THREE.Mesh(this.foodGeometry, material);
      crumb.position.set(
        THREE.MathUtils.clamp(target.x + (random() - 0.5) * 0.95, -bounds.width / 2 + 0.2, bounds.width / 2 - 0.2),
        this.camera.top - 0.08 - random() * 0.18,
        target.z + (random() - 0.5) * 0.5,
      );
      crumb.rotation.z = random() * Math.PI;
      crumb.scale.set(0.55 + random() * 1.05, 0.55 + random() * 0.75, 1);
      crumb.userData.foodDrift = {
        x: (random() - 0.5) * 0.12,
        y: -(0.38 + random() * 0.22),
        z: (random() - 0.5) * 0.08,
      };
      root.add(crumb);
    }
    this.scene.add(root);
    this.foodBursts.push({ root, material, ageSeconds: 0, lifetimeSeconds: 6.5 });
  }

  dispose(): void {
    this.pause();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    for (const actor of this.fishActors.values()) this.disposeObject(actor.root, false);
    for (const actor of this.plantActors.values()) this.disposeObject(actor);
    for (const actor of this.invertebrateActors.values()) this.disposeObject(actor.root);
    for (const burst of this.foodBursts) burst.material.dispose();
    this.foodBursts.length = 0;
    this.fishActors.clear();
    this.plantActors.clear();
    this.invertebrateActors.clear();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.fishFactory.dispose();
    this.foodGeometry.dispose();
    this.renderer.dispose();
  }

  private readonly renderFrame = (timestamp: number): void => {
    if (!this.running || !this.getTank || !this.onFrame) return;
    if (this.lastFrameTime > 0 && timestamp - this.lastFrameTime < FRAME_INTERVAL_MS) return;

    const deltaSeconds = this.lastFrameTime > 0
      ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.25)
      : 0;
    this.lastFrameTime = timestamp;
    this.onFrame(deltaSeconds);
    const animationTime = this.animationClock.advance(deltaSeconds);
    const tank = this.getTank();
    this.syncActors(tank);
    this.animateActors(animationTime, deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  };

  private syncActors(tank: Tank): void {
    const fishIds = new Set(tank.fish.map((fish) => fish.id));
    for (const [id, actor] of this.fishActors) {
      if (!fishIds.has(id)) {
        this.scene.remove(actor.root);
        this.disposeObject(actor.root, false);
        this.fishActors.delete(id);
        this.pendingFeeding.delete(id);
      }
    }
    for (const fish of tank.fish) {
      const existing = this.fishActors.get(fish.id);
      if (existing) {
        existing.fish = fish;
        continue;
      }
      const visual = this.fishFactory.create(fish);
      const actor: FishActor = {
        fish,
        root: visual.root,
        tail: visual.tail,
        pectoralFins: visual.pectoralFins,
        motion: new FishMotion(fish.genome.visual.seed, this.screenBounds()),
        schoolGroup: schoolingGroup(fish.speciesId, fish.genome.lineageSpeciesIds, fish.compatibilityGroup),
      };
      this.fishActors.set(fish.id, actor);
      this.scene.add(actor.root);
      if (this.pendingFeeding.delete(fish.id)) this.triggerFeeding(fish.id);
    }

    const plantIds = new Set(tank.plants.map((plant) => plant.id));
    let plantLayoutChanged = this.removeMissingActors(this.plantActors, plantIds);
    for (const plant of tank.plants) {
      if (this.plantActors.has(plant.id)) continue;
      const actor = this.createPlantVisual(plant);
      this.plantActors.set(plant.id, actor);
      this.scene.add(actor);
      plantLayoutChanged = true;
    }
    if (plantLayoutChanged) this.layoutPlantActors();

    const invertebrateIds = new Set(tank.invertebrates.map((item) => item.id));
    for (const [id, actor] of this.invertebrateActors) {
      if (invertebrateIds.has(id)) continue;
      this.scene.remove(actor.root);
      this.disposeObject(actor.root);
      this.invertebrateActors.delete(id);
    }
    for (const invertebrate of tank.invertebrates) {
      if (this.invertebrateActors.has(invertebrate.id)) continue;
      const actor = this.createInvertebrateVisual(invertebrate);
      this.invertebrateActors.set(invertebrate.id, actor);
      this.scene.add(actor.root);
    }
  }

  private animateActors(time: number, deltaSeconds: number): void {
    const schools = new Map<string, { x: number; y: number; count: number }>();
    for (const actor of this.fishActors.values()) {
      if (!actor.schoolGroup) continue;
      const school = schools.get(actor.schoolGroup) ?? { x: 0, y: 0, count: 0 };
      school.x += actor.root.position.x;
      school.y += actor.root.position.y;
      school.count += 1;
      schools.set(actor.schoolGroup, school);
    }
    for (const school of schools.values()) {
      school.x /= school.count;
      school.y /= school.count;
    }

    for (const actor of this.fishActors.values()) {
      const school = actor.schoolGroup ? schools.get(actor.schoolGroup) : undefined;
      const schoolCenter = school && school.count > 1 ? school : undefined;
      const position = actor.motion.update(
        deltaSeconds,
        this.screenBounds(actor.fish.genome.visual.bodyLength * 0.7 + actor.fish.genome.visual.tailSize * 0.4),
        schoolCenter,
      );
      const scale = actor.fish.id === this.selectedFishId ? 1.12 : 1;
      const ageScale = actor.fish.lifeStage === "juvenile" ? 0.58 : 1;
      actor.root.position.set(position.x, position.y, position.z);
      actor.root.scale.set(position.direction * scale * ageScale, scale * ageScale, scale * ageScale);
      actor.root.rotation.z = position.pitch;
      actor.tail.rotation.y = Math.sin(time * 6 + actor.fish.genome.visual.seed) * 0.36;
      actor.pectoralFins.forEach((fin, index) => {
        fin.rotation.y = Math.sin(time * 7 + actor.fish.genome.visual.seed + index * Math.PI) * 0.11;
      });
    }

    for (const actor of this.plantActors.values()) {
      const plantLimit = Math.max(0, this.camera.right - 1.2);
      actor.position.x = THREE.MathUtils.clamp(actor.position.x, -plantLimit, plantLimit);
      const isFloating = actor.userData.growthForm === "floating";
      const swayPhase = Number(actor.userData.swayPhase ?? actor.position.x);
      actor.rotation.z = Math.sin(time * (isFloating ? 0.34 : 0.52) + swayPhase) * (isFloating ? 0.014 : 0.058);
    }

    for (const actor of this.invertebrateActors.values()) {
      const position = actor.motion.update(deltaSeconds, this.camera.right - this.camera.left);
      actor.root.position.set(position.x, position.y, position.z);
      actor.root.scale.x = position.direction;
      actor.legs.forEach((leg, index) => {
        leg.rotation.z = Math.sin(time * 13 + actor.phase + index * 1.7) * (actor.kind === "shrimp" ? 0.16 : 0.045);
        leg.rotation.x = Math.sin(time * 9 + actor.phase + index) * 0.08;
      });
      actor.feelers.forEach((feeler, index) => {
        feeler.rotation.z = Math.sin(time * 4.7 + actor.phase + index) * 0.12;
      });
    }

    this.scene.traverse((object) => {
      const bubble = object.userData.bubble as {
        baseXFraction: number;
        baseYFraction: number;
        phase: number;
        riseSpeed: number;
        swayWidth: number;
      } | undefined;
      if (!bubble) return;
      const height = this.camera.top - this.camera.bottom;
      const width = this.camera.right - this.camera.left;
      object.position.y = ((bubble.baseYFraction * height + time * bubble.riseSpeed + bubble.phase + height / 2) % height) - height / 2;
      object.position.x = bubble.baseXFraction * width + Math.sin(time * 0.42 + bubble.phase) * bubble.swayWidth;
    });

    for (let index = this.foodBursts.length - 1; index >= 0; index -= 1) {
      const burst = this.foodBursts[index];
      burst.ageSeconds += deltaSeconds;
      if (burst.ageSeconds >= burst.lifetimeSeconds) {
        this.scene.remove(burst.root);
        burst.material.dispose();
        this.foodBursts.splice(index, 1);
        continue;
      }
      burst.material.opacity = 0.95 * (1 - burst.ageSeconds / burst.lifetimeSeconds);
      for (const crumb of burst.root.children) {
        const drift = crumb.userData.foodDrift as { x: number; y: number; z: number };
        crumb.position.x += drift.x * deltaSeconds;
        crumb.position.y += drift.y * deltaSeconds;
        crumb.position.z += drift.z * deltaSeconds;
        crumb.rotation.x += deltaSeconds * 0.6;
        crumb.rotation.y += deltaSeconds * 0.8;
      }
    }
  }

  private createLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xd9eee0, 0x526e5d, 1.75));
    const key = new THREE.DirectionalLight(0xffebc8, 2.2);
    key.position.set(-4, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x97d8c4, 0.95);
    fill.position.set(5, 3, -5);
    this.scene.add(fill);
  }

  private createTankEnvironment(): void {
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.MeshBasicMaterial({ color: 0x2a8990, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    haze.position.set(0, 0, -5.5);
    this.scene.add(haze);

    const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xc7ead6, transparent: true, opacity: 0.01, depthWrite: false, side: THREE.DoubleSide });
    for (let index = 0; index < 5; index += 1) {
      const width = 0.45 + (index % 3) * 0.32;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        -width / 2, 8.5, 0,
        width * 0.5, 8.5, 0,
        width * 2.7, -7, 0,
        -width * 2.3, -7, 0,
      ], 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      const shaft = new THREE.Mesh(geometry, shaftMaterial);
      const horizontalFraction = (index / 4 - 0.5) * 0.92;
      shaft.position.set(horizontalFraction * (this.camera.right - this.camera.left), 0, -4.5);
      shaft.userData.viewportXFraction = horizontalFraction;
      this.scene.add(shaft);
    }

    this.createSubstrate();

    const random = seededRandom(117);
    const pebblePalette = [0x758775, 0x84927c, 0x71847b, 0x9a927a, 0x687e73];
    for (let index = 0; index < 42; index += 1) {
      const size = 0.075 + random() * 0.12;
      const material = new THREE.MeshStandardMaterial({ color: pebblePalette[Math.floor(random() * pebblePalette.length)], roughness: 0.95 });
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(size, 9, 6), material);
      pebble.scale.set(1.1 + random() * 0.7, 0.55 + random() * 0.45, 0.7 + random() * 0.55);
      const horizontalFraction = random() - 0.5;
      pebble.position.set(horizontalFraction * (this.camera.right - this.camera.left), -4.62 + random() * 0.14, 1.1 + random() * 0.55);
      pebble.userData.viewportXFraction = horizontalFraction;
      pebble.rotation.set(random(), random(), random());
      this.scene.add(pebble);
    }

    const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xd5f1ec, transparent: true, opacity: 0.32 });
    for (let index = 0; index < 26; index += 1) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.025 + random() * 0.025, 5, 4), bubbleMaterial);
      const horizontalFraction = random() - 0.5;
      const verticalFraction = random() - 0.5;
      bubble.position.set(
        horizontalFraction * (this.camera.right - this.camera.left),
        verticalFraction * (this.camera.top - this.camera.bottom),
        -1.2 + random() * 2.4,
      );
      bubble.userData.bubble = {
        baseXFraction: horizontalFraction,
        baseYFraction: verticalFraction,
        phase: random() * Math.PI * 2,
        riseSpeed: 0.07 + random() * 0.11,
        swayWidth: 0.035 + random() * 0.11,
      };
      this.scene.add(bubble);
    }
  }

  private createPlantVisual(plant: Plant): THREE.Group {
    const root = this.plantFactory.create(plant, this.camera.top - this.camera.bottom);
    const baseScale = plant.growthForm === "floating" ? 1 : 1.15;
    root.scale.setScalar(baseScale);
    root.position.set(plant.position.x, plant.position.y - (this.camera.top - this.camera.bottom) / 2 + 0.18, plant.position.z);
    root.userData.organismId = plant.id;
    root.userData.growthForm = plant.growthForm;
    root.userData.baseScale = baseScale;
    root.userData.sourceX = plant.position.x;
    root.userData.swayPhase = (plant.visualSeed % 6283) / 1000;
    return root;
  }

  private layoutPlantActors(): void {
    const roots = [...this.plantActors.values()].sort(
      (first, second) => Number(first.userData.sourceX) - Number(second.userData.sourceX),
    );
    const positions = layoutPlantPositions(
      roots.map((root) => Number(root.userData.sourceX)),
      this.camera.right - this.camera.left,
    );
    const viewAspect = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom);
    const horizontalScale = THREE.MathUtils.clamp(viewAspect / 0.9, 0.72, 1);
    roots.forEach((root, index) => {
      const baseScale = Number(root.userData.baseScale ?? 1);
      root.position.x = positions[index];
      root.scale.set(baseScale * horizontalScale, baseScale, baseScale);
    });
  }

  private createSubstrate(): void {
    const segments = 48;
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const upperColour = new THREE.Color(0x567367);
    const lowerColour = new THREE.Color(0x35564c);
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments;
      const x = -20 + t * 40;
      const topY = -4.62 + Math.sin(t * Math.PI * 2.2) * 0.18 + Math.sin(t * Math.PI * 6.4) * 0.065;
      positions.push(x, topY, -2.2, x, -5.45, -2.2);
      const upper = upperColour.clone().multiplyScalar(0.95 + Math.sin(t * Math.PI * 11) * 0.035);
      colours.push(upper.r, upper.g, upper.b, lowerColour.r, lowerColour.g, lowerColour.b);
    }
    for (let index = 0; index < segments; index += 1) {
      const top = index * 2;
      const bottom = top + 1;
      indices.push(top, bottom, bottom + 2, top, bottom + 2, top + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const substrate = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.scene.add(substrate);
  }

  private createInvertebrateVisual(item: AquaticInvertebrate): InvertebrateActor {
    const root = new THREE.Group();
    const snail = item.speciesId.includes("snail");
    const kind = snail ? "snail" : "shrimp";
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: item.colour, roughness: 0.82, flatShading: false });
    const undersideMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(item.colour).multiplyScalar(0.67), roughness: 0.92 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(item.colour).lerp(new THREE.Color(0xf1dfb3), 0.3), roughness: 0.78, flatShading: true });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x263d38, roughness: 0.44 });
    const legs: THREE.Object3D[] = [];
    const feelers: THREE.Object3D[] = [];
    if (snail) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(item.speciesId === "mystery-snail" ? 0.2 : 0.16, 10, 7), bodyMaterial);
      shell.scale.set(1.3, 1, 0.85);
      shell.position.y = 0.15;
      root.add(shell);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5), undersideMaterial);
      foot.scale.set(2.1, 0.48, 0.9);
      foot.position.y = 0.04;
      root.add(foot);
      const spiralPoints: THREE.Vector3[] = [];
      for (let index = 0; index <= 32; index += 1) {
        const turn = (index / 32) * Math.PI * 3.4;
        const radius = 0.008 + (index / 32) * 0.09;
        spiralPoints.push(new THREE.Vector3(-0.025 + Math.cos(turn) * radius, 0.15 + Math.sin(turn) * radius, 0.145));
      }
      const spiral = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPoints), 32, 0.006, 4, false),
        undersideMaterial,
      );
      root.add(spiral);

      const eyestalks = new THREE.Group();
      for (const offset of [-1, 1]) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.14, 5), undersideMaterial);
        stalk.position.set(0.08 + offset * 0.035, 0.17, offset * 0.025);
        eyestalks.add(stalk);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 5), darkMaterial);
        eye.position.set(0.08 + offset * 0.035, 0.245, offset * 0.025);
        eyestalks.add(eye);
      }
      root.add(eyestalks);
      feelers.push(eyestalks);
    } else {
      for (let index = 0; index < 5; index += 1) {
        const segment = new THREE.Mesh(new THREE.SphereGeometry(0.072 - index * 0.006, 8, 6), index < 2 ? bodyMaterial : accentMaterial);
        segment.scale.set(1.25, 0.78, 0.76);
        segment.position.set(0.12 - index * 0.074, 0.12 - index * 0.012, 0);
        root.add(segment);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 6), bodyMaterial);
      head.scale.set(1.12, 0.92, 0.85);
      head.position.set(0.19, 0.13, 0);
      root.add(head);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 5), darkMaterial);
        eye.position.set(0.23, 0.16, side * 0.062);
        root.add(eye);
        const antenna = new THREE.Group();
        antenna.position.set(0.23, 0.17, side * 0.035);
        const points = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.1, 0.15, side * 0.045),
          new THREE.Vector3(0.23, 0.24, side * 0.08),
        ];
        const antennaMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(item.colour).lerp(new THREE.Color(0xf6d9b8), 0.45), roughness: 0.86 });
        antenna.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, 0.008, 4, false), antennaMaterial));
        root.add(antenna);
        feelers.push(antenna);
      }
      const legsGroup = new THREE.Group();
      for (let index = 0; index < 5; index += 1) {
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.14, 4), accentMaterial);
          leg.position.set(0.06 - index * 0.065, 0.005, side * 0.045);
          leg.rotation.z = 2.7 + index * 0.08;
          leg.rotation.x = side * 0.55;
          legsGroup.add(leg);
          legs.push(leg);
        }
      }
      root.add(legsGroup);
      for (let index = 0; index < 3; index += 1) {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 5), accentMaterial);
        tail.position.set(-0.27, 0.04 + index * 0.04, (index - 1) * 0.035);
        tail.rotation.z = -Math.PI / 2;
        tail.rotation.y = (index - 1) * 0.45;
        root.add(tail);
        legs.push(tail);
      }
    }
    const height = this.camera.top - this.camera.bottom;
    const start = {
      x: item.position.x,
      y: item.position.y - height / 2 + 0.2,
      z: item.position.z,
      direction: item.position.x > 0 ? -1 as const : 1 as const,
    };
    root.position.set(start.x, start.y, start.z);
    root.userData.organismId = item.id;
    return {
      root,
      motion: new InvertebrateMotion(hashString(item.id), kind, start, this.camera.right - this.camera.left),
      kind,
      legs,
      feelers,
      phase: (hashString(item.id) % 1000) / 1000 * Math.PI * 2,
    };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.onFishSelected) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(
      [...this.fishActors.values()].map((actor) => actor.root),
      true,
    );
    const selected = intersections[0]?.object.userData.fishId as string | undefined;
    this.onFishSelected(selected ?? null);
  };

  private removeMissingActors(actors: Map<string, THREE.Group>, liveIds: Set<string>): boolean {
    let removed = false;
    for (const [id, actor] of actors) {
      if (liveIds.has(id)) continue;
      this.scene.remove(actor);
      this.disposeObject(actor);
      actors.delete(id);
      removed = true;
    }
    return removed;
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const viewHeight = 10;
    const halfWidth = viewHeight * width / height / 2;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    const viewWidth = this.camera.right - this.camera.left;
    this.scene.traverse((object) => {
      const horizontalFraction = object.userData.viewportXFraction as number | undefined;
      if (horizontalFraction !== undefined) object.position.x = horizontalFraction * viewWidth;
    });
    this.layoutPlantActors();
  }

  private screenBounds(padding = 0.7): { width: number; height: number; padding: number } {
    return { width: this.camera.right - this.camera.left, height: this.camera.top - this.camera.bottom, padding };
  }

  private disposeObject(root: THREE.Object3D, disposeMaterials = true): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (!disposeMaterials) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
}

function schoolingGroup(speciesId: string, lineageSpeciesIds: string[], compatibilityGroup: string): string | null {
  const sourceSpeciesId = speciesId === "hybrid" ? lineageSpeciesIds[0] ?? speciesId : speciesId;
  return speciesById.get(sourceSpeciesId)?.schooling ? compatibilityGroup : null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
