import * as THREE from "three";
import type { Plant } from "../domain/entities";
import { seededRandom } from "../domain/random";

export interface PlantLeafMotion {
  group: THREE.Group;
  baseAngle: number;
  phase: number;
  speed: number;
  amplitude: number;
}

const LEAF_SEGMENTS = 12;
const LEAF_WIDTH_SEGMENTS = 4;

export class PlantMeshFactory {
  create(plant: Plant, tankHeight: number): THREE.Group {
    const random = seededRandom(plant.visualSeed);
    const root = new THREE.Group();
    const leafMotions: PlantLeafMotion[] = [];
    const base = new THREE.Color(plant.colour);
    const leafMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: false,
      roughness: 0.86,
      metalness: 0,
    });
    const veinMaterial = new THREE.LineBasicMaterial({ color: base.clone().multiplyScalar(0.62), transparent: true, opacity: 0.62 });
    const stemColour = plant.growthForm === "floating"
      ? base.clone().lerp(new THREE.Color(0x55784d), 0.7)
      : base.clone().multiplyScalar(0.72);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: stemColour, roughness: 0.92 });
    const addLeaf = (
      x: number,
      y: number,
      z: number,
      length: number,
      width: number,
      bend: number,
      angle: number,
      shade: number,
      phase = random() * Math.PI * 2,
      amplitude = 0.035 + random() * 0.035,
    ): THREE.Group => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.z = angle;
      const leafColour = base.clone().multiplyScalar(shade);
      const geometry = createLeafGeometry(length, width, bend, leafColour);
      group.add(new THREE.Mesh(geometry, leafMaterial));
      const veinPoints = Array.from({ length: 6 }, (_, index) => {
        const t = index / 5;
        return new THREE.Vector3(bend * t * t, length * t, 0.095);
      });
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(veinPoints), veinMaterial));
      root.add(group);
      leafMotions.push({ group, baseAngle: angle, phase, speed: 0.42 + random() * 0.34, amplitude });
      return group;
    };
    const addStem = (points: THREE.Vector3[], radius = 0.018, segments = 5): void => {
      const curve = new THREE.CatmullRomCurve3(points);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, segments, false), stemMaterial);
      root.add(stem);
    };
    const addPad = (x: number, y: number, z: number, radius: number, angle: number): void => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.z = angle;
      const padColour = base.clone().lerp(new THREE.Color(0x663f55), 0.24 + random() * 0.12);
      const geometry = createLilyPadGeometry(radius, padColour);
      const pad = new THREE.Mesh(geometry, leafMaterial);
      pad.position.z = 0.045;
      group.add(pad);
      const veinMaterial = new THREE.LineBasicMaterial({ color: padColour.clone().multiplyScalar(0.7), transparent: true, opacity: 0.72 });
      for (let vein = 0; vein < 5; vein += 1) {
        const angle = -1.25 + vein * 0.48;
        const endX = Math.cos(angle) * radius * 0.83;
        const endY = Math.sin(angle) * radius * 0.83;
        const points = [
          new THREE.Vector3(0.025, 0.008, 0.057),
          new THREE.Vector3(endX * 0.38, endY * 0.42, 0.057),
          new THREE.Vector3(endX, endY, 0.057),
        ];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), veinMaterial));
      }
      root.add(group);
      leafMotions.push({ group, baseAngle: angle, phase: random() * Math.PI * 2, speed: 0.3 + random() * 0.2, amplitude: 0.012 });
    };

    switch (plant.growthForm) {
      case "fern":
        this.createFern(random, addLeaf, addStem);
        break;
      case "stem":
        this.createStemPlant(random, addLeaf, addStem);
        break;
      case "ribbon":
        this.createRibbonPlant(random, addLeaf);
        break;
      case "broad-leaf":
        this.createBroadLeafPlant(random, addLeaf, addStem);
        break;
      case "rosette":
        this.createRosette(random, addLeaf);
        break;
      case "floating":
        this.createFloatingPlant(random, addLeaf, addStem, addPad, tankHeight);
        break;
    }

    root.position.set(plant.position.x, plant.position.y - tankHeight / 2 + 0.18, plant.position.z);
    root.userData.organismId = plant.id;
    root.userData.growthForm = plant.growthForm;
    root.userData.leafMotions = leafMotions;
    return root;
  }

  private createFern(
    random: () => number,
    addLeaf: AddLeaf,
    addStem: (points: THREE.Vector3[], radius?: number, segments?: number) => void,
  ): void {
    for (let frond = 0; frond < 5; frond += 1) {
      const direction = frond < 2 ? -1 : frond > 2 ? 1 : (random() < 0.5 ? -0.28 : 0.28);
      const length = 1.05 + random() * 0.6;
      const height = 1.35 + random() * 0.75;
      const points = [
        new THREE.Vector3((random() - 0.5) * 0.18, 0.02, (random() - 0.5) * 0.12),
        new THREE.Vector3(direction * 0.12, height * 0.42, 0.015),
        new THREE.Vector3(direction * length * 0.55, height * 0.82, 0.025),
        new THREE.Vector3(direction * length, height, 0.02),
      ];
      addStem(points, 0.013, 4);
      for (let pair = 1; pair <= 7; pair += 1) {
        const t = pair / 8;
        const center = catmullRomPoint(points, t);
        const leafletLength = (0.29 + random() * 0.2) * (1 - t * 0.35);
        const outward = direction * (0.9 + random() * 0.3);
        for (const side of [-1, 1]) {
          addLeaf(center.x, center.y, center.z + side * 0.025, leafletLength, 0.09 + random() * 0.035,
            direction * (0.04 + random() * 0.08), Math.atan2(side * 0.78, outward), 0.88 + random() * 0.24);
        }
      }
      const tip = points[3];
      addLeaf(tip.x, tip.y, tip.z, 0.4, 0.09, direction * 0.05, direction * 0.18, 0.98);
    }
  }

  private createStemPlant(
    random: () => number,
    addLeaf: AddLeaf,
    addStem: (points: THREE.Vector3[], radius?: number, segments?: number) => void,
  ): void {
    for (let stalk = 0; stalk < 5; stalk += 1) {
      const x = (stalk - 2) * 0.12 + (random() - 0.5) * 0.12;
      const height = 1.55 + random() * 0.85;
      const lean = (random() - 0.5) * 0.38;
      const points = [
        new THREE.Vector3(x, 0.02, 0),
        new THREE.Vector3(x + lean * 0.25, height * 0.36, 0.01),
        new THREE.Vector3(x + lean * 0.72, height * 0.75, 0.02),
        new THREE.Vector3(x + lean, height, 0.015),
      ];
      addStem(points, 0.011, 4);
      for (let pair = 1; pair <= 7; pair += 1) {
        const t = pair / 8;
        const center = catmullRomPoint(points, t);
        const size = 0.25 + random() * 0.22;
        for (const side of [-1, 1]) {
          const angle = side * (0.64 + random() * 0.4);
          addLeaf(center.x, center.y, center.z + side * 0.025, size, 0.06 + random() * 0.035,
            lean * 0.2, angle, 0.86 + random() * 0.22);
        }
      }
    }
  }

  private createRibbonPlant(random: () => number, addLeaf: AddLeaf): void {
    for (let blade = 0; blade < 8; blade += 1) {
      const direction = (blade - 3.5) / 3.5;
      const height = 1.7 + random() * 1.25;
      addLeaf(
        (random() - 0.5) * 0.2,
        0.02,
        (random() - 0.5) * 0.14,
        height,
        0.15 + random() * 0.08,
        direction * (0.2 + random() * 0.3),
        direction * (0.14 + random() * 0.1),
        0.84 + random() * 0.26,
        random() * Math.PI * 2,
        0.045 + random() * 0.035,
      );
    }
  }

  private createBroadLeafPlant(
    random: () => number,
    addLeaf: AddLeaf,
    addStem: (points: THREE.Vector3[], radius?: number, segments?: number) => void,
  ): void {
    for (let leaf = 0; leaf < 7; leaf += 1) {
      const direction = leaf % 2 === 0 ? -1 : 1;
      const height = 0.55 + random() * 0.9;
      const length = 0.62 + random() * 0.46;
      const x = direction * (0.1 + random() * 0.45);
      addStem([
        new THREE.Vector3(0, 0.03, 0),
        new THREE.Vector3(x * 0.35, height * 0.45, 0.02),
        new THREE.Vector3(x, height, 0.03),
      ], 0.012, 4);
      addLeaf(x, height, 0.03, length, 0.24 + random() * 0.08,
        direction * (0.08 + random() * 0.11), direction * (0.58 + random() * 0.32), 0.86 + random() * 0.22);
    }
  }

  private createRosette(random: () => number, addLeaf: AddLeaf): void {
    for (let leaf = 0; leaf < 11; leaf += 1) {
      const around = leaf / 11 * Math.PI * 2;
      const length = 0.95 + random() * 0.7;
      addLeaf(
        Math.cos(around) * 0.08,
        0.02,
        Math.sin(around) * 0.08,
        length,
        0.17 + random() * 0.08,
        Math.cos(around) * (0.15 + random() * 0.16),
        Math.cos(around) * 0.48,
        0.76 + random() * 0.3,
        random() * Math.PI * 2,
        0.04 + random() * 0.035,
      );
    }
  }

  private createFloatingPlant(
    random: () => number,
    addLeaf: AddLeaf,
    addStem: (points: THREE.Vector3[], radius?: number, segments?: number) => void,
    addPad: (x: number, y: number, z: number, radius: number, angle: number) => void,
    tankHeight: number,
  ): void {
    const surface = tankHeight - 1.2;
    for (let pad = 0; pad < 4; pad += 1) {
      const x = (pad - 1.5) * 0.48 + (random() - 0.5) * 0.14;
      const z = (random() - 0.5) * 0.3;
      const lean = (random() - 0.5) * 0.22;
      addStem([
        new THREE.Vector3((random() - 0.5) * 0.18, 0.02, z * 0.3),
        new THREE.Vector3(x * 0.2, surface * 0.28, z * 0.5),
        new THREE.Vector3(x + lean * 0.7, surface * 0.64, z),
        new THREE.Vector3(x + lean, surface, z),
      ], 0.014, 4);
      addLeaf(x * 0.55 + lean * 0.2, surface * 0.52, z + 0.035, 0.58 + random() * 0.2, 0.2 + random() * 0.06,
        (random() - 0.5) * 0.1, (random() < 0.5 ? -1 : 1) * (0.46 + random() * 0.22), 0.84 + random() * 0.17,
        random() * Math.PI * 2, 0.02);
      addPad(x + lean, surface, z, 0.34 + random() * 0.1, (random() - 0.5) * 0.24);
    }
  }
}

function createLilyPadGeometry(radius: number, base: THREE.Color): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, radius, 0.42, Math.PI * 2 - 0.42, false);
  shape.lineTo(0, 0);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 20);
  const positions = geometry.getAttribute("position");
  const colours: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const distance = Math.min(1, Math.hypot(positions.getX(index), positions.getY(index)) / radius);
    const colour = base.clone().lerp(new THREE.Color(0xc3a16c), (1 - distance) * 0.15).multiplyScalar(1 - distance * 0.12);
    colours.push(colour.r, colour.g, colour.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createLeafGeometry(length: number, width: number, bend: number, base: THREE.Color): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= LEAF_SEGMENTS; row += 1) {
    const t = row / LEAF_SEGMENTS;
    const taper = Math.pow(Math.sin(Math.PI * t), 0.72);
    const centerX = bend * t * t;
    const centerZ = 0.045 * Math.sin(Math.PI * t);
    const leafColour = base.clone().lerp(new THREE.Color(0xd2d996), 0.1 + 0.16 * t);
    for (let column = 0; column <= LEAF_WIDTH_SEGMENTS; column += 1) {
      const across = column / LEAF_WIDTH_SEGMENTS * 2 - 1;
      const cup = (1 - across * across) * 0.035;
      positions.push(centerX + across * width * taper, length * t, centerZ + cup);
      const edgeTint = Math.abs(across) * 0.08;
      const colour = leafColour.clone().multiplyScalar(1 - edgeTint);
      colours.push(colour.r, colour.g, colour.b);
    }
  }
  const rowSize = LEAF_WIDTH_SEGMENTS + 1;
  for (let row = 0; row < LEAF_SEGMENTS; row += 1) {
    for (let column = 0; column < LEAF_WIDTH_SEGMENTS; column += 1) {
      const a = row * rowSize + column;
      const b = a + rowSize;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function catmullRomPoint(points: THREE.Vector3[], t: number): THREE.Vector3 {
  const curve = new THREE.CatmullRomCurve3(points);
  return curve.getPoint(t);
}

type AddLeaf = (
  x: number,
  y: number,
  z: number,
  length: number,
  width: number,
  bend: number,
  angle: number,
  shade: number,
  phase?: number,
  amplitude?: number,
) => THREE.Group;

