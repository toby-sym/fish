import * as THREE from "three";
import { speciesById } from "../data/profiles";
import type { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { seededRandom } from "../domain/random";
import type { Tank } from "../domain/tank";
import { FishMeshFactory } from "./FishMeshFactory";
import { FishMotion } from "./FishMotion";
import { InvertebrateMotion } from "./InvertebrateMotion";
import type { InvertebrateKind } from "./InvertebrateMotion";
import { PlantMeshFactory } from "./PlantMeshFactory";
import type { PlantLeafMotion } from "./PlantMeshFactory";

interface FishActor {
  fish: Fish;
  root: THREE.Group;
  tail: THREE.Group;
  pectoralFins: [THREE.Group, THREE.Group];
  motion: FishMotion;
  schoolGroup: string | null;
  tailFrequency: number;
  tailAmplitude: number;
  finFrequency: number;
  finAmplitude: number;
  animationPhase: number;
}

interface InvertebrateActor {
  root: THREE.Group;
  motion: InvertebrateMotion;
  kind: InvertebrateKind;
  legs: THREE.Object3D[];
  feelers: THREE.Object3D[];
  segments: THREE.Object3D[];
  foot?: THREE.Mesh;
  phase: number;
}

interface FoodBurst {
  root: THREE.Group;
  material: THREE.MeshBasicMaterial;
  ageSeconds: number;
  lifetimeSeconds: number;
}

const FRAME_INTERVAL_MS = 1000 / 30;

export class AquariumRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 60);
  private readonly fishFactory = new FishMeshFactory();
  private readonly plantFactory = new PlantMeshFactory();
  private readonly foodGeometry = createFlakeGeometry();
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
    this.renderer.toneMappingExposure = 1.18;
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x0d4b58, 23, 48);
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
    const surfaceY = this.camera.top - 0.12;
    const target = {
      x: THREE.MathUtils.clamp(actor.root.position.x, this.camera.left + 0.65, this.camera.right - 0.65),
      y: surfaceY - 0.58,
      z: 0.25,
    };
    actor.motion.feedAt(target, bounds, 5.5);

    const material = new THREE.MeshBasicMaterial({ color: 0xffca72, transparent: true, opacity: 0.95, depthWrite: false });
    const root = new THREE.Group();
    const random = seededRandom(actor.fish.genome.visual.seed ^ Math.floor(performance.now()));
    for (let index = 0; index < 9; index += 1) {
      const crumb = new THREE.Mesh(this.foodGeometry, material);
      crumb.position.set(
        target.x + (random() - 0.5) * 1.2,
        surfaceY - random() * 0.09,
        target.z + (random() - 0.5) * 0.32,
      );
      const flakeSize = 0.035 + random() * 0.026;
      crumb.scale.set(flakeSize * (0.8 + random() * 0.7), flakeSize * (0.7 + random() * 0.5), 1);
      crumb.rotation.z = random() * Math.PI * 2;
      crumb.userData.foodDrift = {
        x: (random() - 0.5) * 0.045,
        y: -(0.075 + random() * 0.095),
        z: (random() - 0.5) * 0.025,
      };
      root.add(crumb);
    }
    this.scene.add(root);
    this.foodBursts.push({ root, material, ageSeconds: 0, lifetimeSeconds: 5.4 });
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
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
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
    const tank = this.getTank();
    this.syncActors(tank);
    this.animateActors(timestamp / 1000, deltaSeconds);
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
      const animationRandom = seededRandom(fish.genome.visual.seed ^ 0x3c6ef372);
      const actor: FishActor = {
        fish,
        root: visual.root,
        tail: visual.tail,
        pectoralFins: visual.pectoralFins,
        motion: new FishMotion(fish.genome.visual.seed, this.screenBounds()),
        schoolGroup: schoolingGroup(fish.speciesId, fish.genome.lineageSpeciesIds, fish.compatibilityGroup),
        tailFrequency: 4.1 + animationRandom() * 1.7,
        tailAmplitude: 0.17 + animationRandom() * 0.11,
        finFrequency: 5.2 + animationRandom() * 1.8,
        finAmplitude: 0.12 + animationRandom() * 0.08,
        animationPhase: animationRandom() * Math.PI * 2,
      };
      this.fishActors.set(fish.id, actor);
      this.scene.add(actor.root);
      if (this.pendingFeeding.delete(fish.id)) this.triggerFeeding(fish.id);
    }

    const plantIds = new Set(tank.plants.map((plant) => plant.id));
    this.removeMissingActors(this.plantActors, plantIds, (actor) => actor);
    for (const plant of tank.plants) {
      if (this.plantActors.has(plant.id)) continue;
      const actor = this.createPlantVisual(plant);
      this.plantActors.set(plant.id, actor);
      this.scene.add(actor);
    }

    const invertebrateIds = new Set(tank.invertebrates.map((item) => item.id));
    this.removeMissingActors(this.invertebrateActors, invertebrateIds, (actor) => actor.root);
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

    for (const actor of this.invertebrateActors.values()) {
      const position = actor.motion.update(deltaSeconds, this.camera.right - this.camera.left);
      actor.root.position.set(position.x, position.y, position.z);
      actor.root.scale.x = position.direction;
      if (actor.kind === "shrimp") {
        actor.legs.forEach((leg, index) => {
          leg.rotation.z = Math.sin(time * 10 + actor.phase + index * Math.PI * 0.58) * 0.16;
        });
        actor.feelers.forEach((feeler, index) => {
          feeler.rotation.z = Math.sin(time * 2.3 + actor.phase + index * Math.PI) * 0.09;
        });
        actor.segments.forEach((segment, index) => {
          segment.rotation.z = Math.sin(time * 5.5 - index * 0.38 + actor.phase) * 0.035;
        });
      } else {
        actor.feelers.forEach((feeler, index) => {
          feeler.rotation.z = Math.sin(time * 0.8 + actor.phase + index * Math.PI) * 0.045;
        });
        if (actor.foot) actor.foot.scale.x = 1.2 + Math.sin(time * 1.4 + actor.phase) * 0.035;
      }
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
      actor.tail.rotation.y = Math.sin(time * actor.tailFrequency + actor.animationPhase) * actor.tailAmplitude;
      actor.pectoralFins.forEach((fin, index) => {
        fin.rotation.y = Math.sin(time * actor.finFrequency + actor.animationPhase + index * Math.PI) * actor.finAmplitude;
        fin.rotation.z = Math.sin(time * actor.finFrequency * 0.7 + actor.animationPhase + index * Math.PI) * 0.035;
      });
    }

    for (const actor of this.plantActors.values()) {
      const leaves = actor.userData.leafMotions as PlantLeafMotion[] | undefined;
      leaves?.forEach((leaf) => {
        leaf.group.rotation.z = leaf.baseAngle + Math.sin(time * leaf.speed + leaf.phase) * leaf.amplitude;
      });
    }

    this.scene.traverse((object) => {
      const bubble = object.userData.bubble as { baseY: number; phase: number } | undefined;
      if (!bubble) return;
      const height = this.camera.top - this.camera.bottom;
      object.position.y = ((bubble.baseY + time * 0.13 + bubble.phase + height / 2) % height) - height / 2;
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
    this.scene.add(new THREE.HemisphereLight(0xc4edf0, 0x28423a, 2.05));
    const key = new THREE.DirectionalLight(0xffe7ba, 2.7);
    key.position.set(-4, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x7bd6d7, 0.85);
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

    const pebbleColours = [0x748776, 0x8d8368, 0x617d72, 0x8d9978, 0x6e6c59];
    const random = seededRandom(117);
    for (let index = 0; index < 30; index += 1) {
      const size = 0.08 + random() * 0.2;
      const material = new THREE.MeshStandardMaterial({
        color: pebbleColours[Math.floor(random() * pebbleColours.length)],
        roughness: 0.95,
        flatShading: true,
        transparent: true,
        opacity: 0.78,
      });
      const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), material);
      pebble.scale.set(1.15 + random() * 0.95, 0.4 + random() * 0.4, 0.65 + random() * 0.45);
      pebble.position.set(-8 + random() * 16, -4.45 + random() * 0.22, -1.8 + random() * 3.2);
      pebble.rotation.set(random(), random(), random());
      this.scene.add(pebble);
    }

    const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xd5f1ec, transparent: true, opacity: 0.32 });
    for (let index = 0; index < 26; index += 1) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.025 + random() * 0.025, 5, 4), bubbleMaterial);
      bubble.position.set(-8 + random() * 16, -4.8 + random() * 9.6, -1.2 + random() * 2.4);
      bubble.userData.bubble = { baseY: bubble.position.y, phase: random() * Math.PI * 2 };
      this.scene.add(bubble);
    }
  }

  private createPlantVisual(plant: Plant): THREE.Group {
    return this.plantFactory.create(plant, this.camera.top - this.camera.bottom);
  }

  private createInvertebrateVisual(item: AquaticInvertebrate): InvertebrateActor {
    const root = new THREE.Group();
    const kind: InvertebrateKind = item.speciesId.includes("snail") ? "snail" : "shrimp";
    const baseColour = new THREE.Color(item.colour);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: baseColour, roughness: 0.68, flatShading: false });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: baseColour.clone().lerp(new THREE.Color(0xffd98a), 0.36), roughness: 0.58, flatShading: false });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: baseColour.clone().multiplyScalar(0.55), roughness: 0.8 });
    const paleMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e9c8, roughness: 0.5 });
    const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x22302d });
    const legs: THREE.Object3D[] = [];
    const feelers: THREE.Object3D[] = [];
    const segments: THREE.Object3D[] = [];
    let foot: THREE.Mesh | undefined;
    const phase = seededRandom(hashString(item.id))() * Math.PI * 2;

    if (kind === "snail") {
      const shellSize = item.speciesId === "mystery-snail" ? 0.24 : 0.205;
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), accentMaterial);
      shell.scale.set(shellSize * 1.05, shellSize, shellSize * 0.78);
      shell.position.set(-0.045, 0.2, 0);
      root.add(shell);
      const shellBand = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), darkMaterial);
      shellBand.scale.set(shellSize * 1.055, shellSize * 0.38, shellSize * 0.79);
      shellBand.position.set(-0.05, 0.28, 0);
      shellBand.rotation.z = -0.15;
      root.add(shellBand);
      const spiralPoints = Array.from({ length: 36 }, (_, index) => {
        const t = index / 35;
        const angle = t * Math.PI * 4.4;
        const radius = shellSize * 0.52 * (1 - t * 0.86);
        return new THREE.Vector3(-0.045 + Math.cos(angle) * radius, 0.2 + Math.sin(angle) * radius, shellSize * 0.79 + 0.008);
      });
      root.add(createTube(spiralPoints, paleMaterial, 0.009, 5));
      foot = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), bodyMaterial);
      foot.scale.set(0.29, 0.075, 0.13);
      foot.position.set(0.04, 0.04, 0);
      root.add(foot);
      for (let index = 0; index < 2; index += 1) {
        const side = index === 0 ? -1 : 1;
        const stalk = new THREE.Group();
        stalk.position.set(0.19, 0.09, side * 0.045);
        const stalkCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.015, 0.14, side * 0.01), new THREE.Vector3(0.06, 0.23, side * 0.015),
        ]);
        stalk.add(new THREE.Mesh(new THREE.TubeGeometry(stalkCurve, 8, 0.012, 5, false), bodyMaterial));
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), paleMaterial);
        eye.position.set(0.06, 0.23, side * 0.015);
        stalk.add(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), blackMaterial);
        pupil.position.set(0.076, 0.231, side * 0.021);
        stalk.add(pupil);
        root.add(stalk);
        feelers.push(stalk);
      }
    } else {
      const tail = new THREE.Group();
      tail.position.set(-0.31, 0.12, 0);
      for (let index = 0; index < 4; index += 1) {
        const fan = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), accentMaterial);
        fan.scale.set(0.075, 0.025, 0.047);
        fan.position.set(-0.045, (index - 1.5) * 0.034, (index % 2 ? 1 : -1) * 0.025);
        fan.rotation.z = -0.4;
        tail.add(fan);
      }
      root.add(tail);
      for (let index = 0; index < 5; index += 1) {
        const segment = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), index % 2 ? bodyMaterial : accentMaterial);
        const radius = 0.09 - index * 0.009;
        segment.scale.set(0.07, radius, radius * 0.82);
        segment.position.set(-0.2 + index * 0.075, 0.145 - index * 0.006, 0);
        root.add(segment);
        segments.push(segment);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), bodyMaterial);
      head.scale.set(1.15, 0.9, 0.82);
      head.position.set(0.22, 0.15, 0);
      root.add(head);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), blackMaterial);
        eye.position.set(0.265, 0.205, side * 0.063);
        root.add(eye);
      }
      for (let index = 0; index < 6; index += 1) {
        const side = index % 2 === 0 ? -1 : 1;
        const leg = new THREE.Group();
        leg.position.set(-0.12 + Math.floor(index / 2) * 0.085, 0.09, side * 0.055);
        const legCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.025, -0.055, side * 0.035), new THREE.Vector3(0.08, -0.105, side * 0.045),
        ]);
        leg.add(new THREE.Mesh(new THREE.TubeGeometry(legCurve, 5, 0.009, 4, false), darkMaterial));
        root.add(leg);
        legs.push(leg);
      }
      for (let index = 0; index < 2; index += 1) {
        const side = index === 0 ? -1 : 1;
        const feeler = new THREE.Group();
        feeler.position.set(0.28, 0.18, side * 0.025);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.11, 0.14, side * 0.045), new THREE.Vector3(0.27, 0.18, side * 0.08),
        ]);
        feeler.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.006, 4, false), accentMaterial));
        root.add(feeler);
        feelers.push(feeler);
      }
    }

    const floorY = item.position.y - (this.camera.top - this.camera.bottom) / 2 + 0.2;
    const start = { x: item.position.x, y: floorY, z: item.position.z, direction: item.id.charCodeAt(item.id.length - 1) % 2 ? 1 as const : -1 as const };
    const motion = new InvertebrateMotion(hashString(item.id), kind, start, this.camera.right - this.camera.left);
    root.position.set(start.x, start.y, start.z);
    root.userData.organismId = item.id;
    return { root, motion, kind, legs, feelers, segments, foot, phase };
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

  private removeMissingActors<T>(actors: Map<string, T>, liveIds: Set<string>, getRoot: (actor: T) => THREE.Object3D): void {
    for (const [id, actor] of actors) {
      if (liveIds.has(id)) continue;
      const root = getRoot(actor);
      this.scene.remove(root);
      this.disposeObject(root);
      actors.delete(id);
    }
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
  }

  private screenBounds(padding = 0.7): { width: number; height: number; padding: number } {
    return { width: this.camera.right - this.camera.left, height: this.camera.top - this.camera.bottom, padding };
  }

  private disposeObject(root: THREE.Object3D, disposeMaterials = true): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
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

function createFlakeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.8, -0.32);
  shape.lineTo(-0.38, -0.68);
  shape.lineTo(0.05, -0.45);
  shape.lineTo(0.56, -0.55);
  shape.lineTo(0.78, -0.1);
  shape.lineTo(0.45, 0.22);
  shape.lineTo(0.62, 0.58);
  shape.lineTo(0.1, 0.5);
  shape.lineTo(-0.16, 0.72);
  shape.lineTo(-0.48, 0.34);
  shape.lineTo(-0.8, 0.4);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  return geometry;
}

function createTube(points: THREE.Vector3[], material: THREE.Material, radius: number, tubularSegments: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, radius, tubularSegments, false), material);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}
