import * as THREE from "three";
import type { AquaticInvertebrate, Fish, Plant } from "../domain/entities";
import { seededRandom } from "../domain/random";
import type { Tank } from "../domain/tank";
import { FishMeshFactory } from "./FishMeshFactory";

interface FishActor {
  fish: Fish;
  root: THREE.Group;
  tail: THREE.Group;
  phase: number;
  speed: number;
  travel: number;
}

const FRAME_INTERVAL_MS = 1000 / 30;

export class AquariumRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  private readonly fishFactory = new FishMeshFactory();
  private readonly fishActors = new Map<string, FishActor>();
  private readonly plantActors = new Map<string, THREE.Group>();
  private readonly invertebrateActors = new Map<string, THREE.Group>();
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
      alpha: false,
      powerPreference: "low-power",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.scene.background = new THREE.Color(0x0d4b58);
    this.scene.fog = new THREE.Fog(0x0d4b58, 13, 30);
    this.camera.position.set(0, 4.1, 12.4);
    this.camera.lookAt(0, 1.65, 0);
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

  dispose(): void {
    this.pause();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    for (const actor of this.fishActors.values()) this.disposeObject(actor.root, false);
    for (const actor of this.plantActors.values()) this.disposeObject(actor);
    for (const actor of this.invertebrateActors.values()) this.disposeObject(actor);
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
    this.animateActors(timestamp / 1000);
    this.renderer.render(this.scene, this.camera);
  };

  private syncActors(tank: Tank): void {
    const fishIds = new Set(tank.fish.map((fish) => fish.id));
    for (const [id, actor] of this.fishActors) {
      if (!fishIds.has(id)) {
        this.scene.remove(actor.root);
        this.disposeObject(actor.root, false);
        this.fishActors.delete(id);
      }
    }
    for (const fish of tank.fish) {
      const existing = this.fishActors.get(fish.id);
      if (existing) {
        existing.fish = fish;
        continue;
      }
      const visual = this.fishFactory.create(fish);
      const random = seededRandom(fish.genome.visual.seed);
      const actor: FishActor = {
        fish,
        root: visual.root,
        tail: visual.tail,
        phase: random() * Math.PI * 2,
        speed: 0.24 + random() * 0.16,
        travel: 2.3 + random() * 2,
      };
      this.fishActors.set(fish.id, actor);
      this.scene.add(actor.root);
    }

    const plantIds = new Set(tank.plants.map((plant) => plant.id));
    this.removeMissingActors(this.plantActors, plantIds);
    for (const plant of tank.plants) {
      if (this.plantActors.has(plant.id)) continue;
      const actor = this.createPlantVisual(plant);
      this.plantActors.set(plant.id, actor);
      this.scene.add(actor);
    }

    const invertebrateIds = new Set(tank.invertebrates.map((item) => item.id));
    this.removeMissingActors(this.invertebrateActors, invertebrateIds);
    for (const invertebrate of tank.invertebrates) {
      if (this.invertebrateActors.has(invertebrate.id)) continue;
      const actor = this.createInvertebrateVisual(invertebrate);
      this.invertebrateActors.set(invertebrate.id, actor);
      this.scene.add(actor);
    }
  }

  private animateActors(time: number): void {
    for (const actor of this.fishActors.values()) {
      const phase = time * actor.speed + actor.phase;
      const x = Math.sin(phase) * actor.travel;
      const direction = Math.cos(phase) >= 0 ? 1 : -1;
      const scale = actor.fish.id === this.selectedFishId ? 1.12 : 1;
      actor.root.position.set(x, 1.55 + Math.sin(phase * 0.72) * 0.55, -0.8 + Math.sin(phase * 0.43 + actor.phase) * 1.05);
      actor.root.scale.set(direction * scale, scale, scale);
      actor.root.rotation.z = Math.sin(phase * 0.8) * 0.045;
      actor.tail.rotation.y = Math.sin(phase * 5.2) * 0.36;
    }

    for (const actor of this.plantActors.values()) {
      actor.rotation.z = Math.sin(time * 0.55 + actor.position.x) * 0.035;
    }

    this.scene.traverse((object) => {
      const bubble = object.userData.bubble as { baseY: number; phase: number } | undefined;
      if (!bubble) return;
      object.position.y = (bubble.baseY + time * 0.13 + bubble.phase) % 4.1;
    });
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
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 5),
      new THREE.MeshStandardMaterial({ color: 0x907e5e, roughness: 1, flatShading: true }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -0.2);
    this.scene.add(floor);

    const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(12.2, 4.1, 3.4));
    const frame = new THREE.LineSegments(frameGeometry, new THREE.LineBasicMaterial({ color: 0x9bd9d5, transparent: true, opacity: 0.22 }));
    frame.position.set(0, 2.05, -0.25);
    this.scene.add(frame);

    const pebbleMaterial = new THREE.MeshStandardMaterial({ color: 0x746e59, roughness: 0.95, flatShading: true });
    const random = seededRandom(117);
    for (let index = 0; index < 30; index += 1) {
      const size = 0.07 + random() * 0.12;
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), pebbleMaterial);
      pebble.position.set(-5.8 + random() * 11.6, 0.05 + size * 0.3, -1.8 + random() * 3.2);
      pebble.rotation.set(random(), random(), random());
      this.scene.add(pebble);
    }

    const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xd5f1ec, transparent: true, opacity: 0.32 });
    for (let index = 0; index < 14; index += 1) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.025 + random() * 0.025, 5, 4), bubbleMaterial);
      bubble.position.set(-4.8 + random() * 9.6, random() * 3.8, -1.2 + random() * 2.4);
      bubble.userData.bubble = { baseY: bubble.position.y, phase: random() * Math.PI * 2 };
      this.scene.add(bubble);
    }
  }

  private createPlantVisual(plant: Plant): THREE.Group {
    const random = seededRandom(plant.visualSeed);
    const positions: number[] = [];
    const colours: number[] = [];
    const base = new THREE.Color(plant.colour);
    const leaves = plant.speciesId === "hornwort" ? 12 : 8;
    for (let index = 0; index < leaves; index += 1) {
      const angle = (index / leaves) * Math.PI * 2;
      const height = 0.75 + random() * 1.1;
      const width = 0.1 + random() * 0.13;
      const z = Math.sin(angle) * 0.16;
      const x = Math.cos(angle) * 0.12;
      const bend = (random() - 0.5) * 0.38;
      const leafPoints = [
        [0, 0.05, 0],
        [x + bend - width, height * 0.5, z],
        [x + bend, height, z],
        [x + bend + width, height * 0.52, z],
      ];
      for (const triangle of [[leafPoints[0], leafPoints[1], leafPoints[2]], [leafPoints[0], leafPoints[2], leafPoints[3]]]) {
        const colour = base.clone().multiplyScalar(0.88 + random() * 0.32);
        for (const point of triangle) {
          positions.push(point[0], point[1], point[2]);
          colours.push(colour.r, colour.g, colour.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.92 });
    const leavesMesh = new THREE.Mesh(geometry, material);
    const root = new THREE.Group();
    root.add(leavesMesh);
    root.position.set(plant.position.x, plant.position.y, plant.position.z);
    root.userData.organismId = plant.id;
    return root;
  }

  private createInvertebrateVisual(item: AquaticInvertebrate): THREE.Group {
    const root = new THREE.Group();
    const colour = new THREE.MeshStandardMaterial({ color: item.colour, roughness: 0.72, flatShading: true });
    if (item.speciesId === "nerite-snail") {
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), colour);
      shell.position.y = 0.15;
      root.add(shell);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshStandardMaterial({ color: 0x9a8770, flatShading: true }));
      foot.scale.set(1.8, 0.55, 0.9);
      foot.position.y = 0.04;
      root.add(foot);
    } else {
      const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 2, 6), colour);
      abdomen.rotation.z = Math.PI / 2;
      abdomen.scale.set(1, 0.85, 0.85);
      abdomen.position.y = 0.12;
      root.add(abdomen);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), colour);
      head.position.set(0.19, 0.13, 0);
      root.add(head);
      for (let index = 0; index < 4; index += 1) {
        const leg = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.17, 4), colour);
        leg.rotation.z = Math.PI / 2 + (index % 2 ? 0.35 : -0.35);
        leg.position.set(-0.08 + index * 0.05, 0.025, index % 2 ? 0.07 : -0.07);
        root.add(leg);
      }
    }
    root.position.set(item.position.x, item.position.y, item.position.z);
    root.userData.organismId = item.id;
    return root;
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

  private removeMissingActors(actors: Map<string, THREE.Group>, liveIds: Set<string>): void {
    for (const [id, actor] of actors) {
      if (liveIds.has(id)) continue;
      this.scene.remove(actor);
      this.disposeObject(actor);
      actors.delete(id);
    }
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
