import * as THREE from "three";
import type { Plant } from "../domain/entities";
import { seededRandom } from "../domain/random";

type Point = { x: number; y: number; z: number };

/** Builds soft, individually varied plant meshes without relying on image assets. */
export class PlantMeshFactory {
  create(plant: Plant, tankHeight = 10): THREE.Group {
    const random = seededRandom(plant.visualSeed);
    const leaves = new LeafBatch(new THREE.Color(plant.colour));
    const root = new THREE.Group();
    const stemColour = new THREE.Color(plant.colour);
    if (plant.growthForm === "floating") stemColour.set(0x647d55);
    else if (plant.growthForm === "rosette") stemColour.lerp(new THREE.Color(0x637c56), 0.42);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: stemColour.multiplyScalar(0.72),
      roughness: 0.94,
      flatShading: false,
    });

    switch (plant.growthForm) {
      case "fern": this.makeFern(root, leaves, stemMaterial, random); break;
      case "broad-leaf": this.makeBroadLeaf(root, leaves, stemMaterial, random); break;
      case "stem": this.makeHornwort(root, leaves, stemMaterial, random); break;
      case "ribbon": this.makeRibbons(root, leaves, stemMaterial, random); break;
      case "rosette": this.makeRosette(root, leaves, stemMaterial, random); break;
      case "floating": this.makeFloating(root, leaves, stemMaterial, random, tankHeight); break;
    }

    const leafGeometry = leaves.geometry();
    const leafMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    root.add(new THREE.Mesh(leafGeometry, leafMaterial));
    return root;
  }

  private makeFern(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number): void {
    const fronds = 5;
    for (let frond = 0; frond < fronds; frond += 1) {
      const angle = (frond / fronds) * Math.PI * 2 + (random() - 0.5) * 0.3;
      const height = 1.15 + random() * 0.65;
      const spread = 0.2 + random() * 0.28;
      const path = stemPath(angle, height, spread, 0.11 + random() * 0.12);
      addStem(root, path, 0.018, stems);
      for (let index = 1; index <= 7; index += 1) {
        const t = 0.15 + index * 0.095;
        const point = pointOnStem(path, t);
        const reach = (0.19 + random() * 0.1) * (1 - t * 0.35);
        for (const side of [-1, 1]) {
          const leafletEnd = {
            x: point.x + Math.cos(angle + side * 0.95) * reach,
            y: point.y + 0.06 + random() * 0.07,
            z: point.z + Math.sin(angle + side * 0.95) * reach,
          };
          leaves.add(point, leafletEnd, 0.07 + random() * 0.035, (random() - 0.5) * 0.08);
        }
      }
    }
  }

  private makeBroadLeaf(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number): void {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + (random() - 0.5) * 0.24;
      const height = 0.48 + random() * 0.55;
      const reach = 0.48 + random() * 0.5;
      const start = { x: 0, y: 0.06, z: 0 };
      const end = { x: Math.cos(angle) * reach, y: height, z: Math.sin(angle) * reach * 0.65 };
      addStem(root, [start, { x: end.x * 0.48, y: height * 0.58, z: end.z * 0.5 }, end], 0.022, stems);
      leaves.add(start, end, 0.21 + random() * 0.09, (random() - 0.5) * 0.12, 0.08);
    }
  }

  private makeHornwort(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number): void {
    for (let stalk = 0; stalk < 4; stalk += 1) {
      const angle = (stalk / 4) * Math.PI * 2 + (random() - 0.5) * 0.35;
      const height = 1.45 + random() * 0.65;
      const path = stemPath(angle, height, 0.24 + random() * 0.18, 0.12);
      addStem(root, path, 0.016, stems);
      for (let level = 0; level < 5; level += 1) {
        const t = 0.22 + level * 0.13;
        const centre = pointOnStem(path, t);
        const radialLength = 0.2 * (1 - t * 0.4) + random() * 0.08;
        for (let spoke = 0; spoke < 5; spoke += 1) {
          const spokeAngle = angle + (spoke / 5) * Math.PI * 2 + t * 3.2;
          const tip = {
            x: centre.x + Math.cos(spokeAngle) * radialLength,
            y: centre.y + 0.05 + random() * 0.08,
            z: centre.z + Math.sin(spokeAngle) * radialLength,
          };
          leaves.add(centre, tip, 0.045 + random() * 0.025, 0.035);
        }
      }
    }
  }

  private makeRibbons(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number): void {
    for (let index = 0; index < 7; index += 1) {
      const angle = (index / 7) * Math.PI * 2 + (random() - 0.5) * 0.24;
      const height = 1.5 + random() * 1.25;
      const reach = 0.32 + random() * 0.48;
      const start = { x: 0, y: 0.04, z: 0 };
      const end = { x: Math.cos(angle) * reach, y: height, z: Math.sin(angle) * reach * 0.55 };
      const middle = { x: end.x * 0.55 + Math.sin(index * 2.1) * 0.22, y: height * 0.58, z: end.z * 0.52 };
      leaves.add(start, middle, 0.105 + random() * 0.055, (random() - 0.5) * 0.3, 0.035, end);
    }
  }

  private makeRosette(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number): void {
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + (random() - 0.5) * 0.4;
      const length = 0.45 + random() * 0.72;
      const rise = 0.24 + random() * 0.58;
      const start = { x: 0, y: 0.025, z: 0 };
      const end = { x: Math.cos(angle) * length, y: rise, z: Math.sin(angle) * length * 0.62 };
      leaves.add(start, end, 0.17 + random() * 0.08, (random() - 0.5) * 0.1, 0.045);
    }
  }

  private makeFloating(root: THREE.Group, leaves: LeafBatch, stems: THREE.Material, random: () => number, tankHeight: number): void {
    const waterline = tankHeight * 0.9;
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2 + (random() - 0.5) * 0.35;
      const reach = 0.55 + random() * 0.65;
      const end = { x: Math.cos(angle) * reach, y: waterline - 0.1 + random() * 0.12, z: Math.sin(angle) * reach * 0.55 };
      const shoulder = { x: end.x * 0.24, y: end.y * 0.6, z: end.z * 0.24 };
      addStem(root, [{ x: 0, y: 0.02, z: 0 }, shoulder, { x: end.x * 0.78, y: end.y * 0.91, z: end.z * 0.78 }, end], 0.022, stems);
      leaves.addPad({ x: end.x, y: end.y + 0.03, z: end.z }, 0.24 + random() * 0.1, 0.13 + random() * 0.06, angle + Math.PI * 0.35);
    }
  }
}

class LeafBatch {
  private readonly positions: number[] = [];
  private readonly colours: number[] = [];
  private readonly indices: number[] = [];
  private readonly base: THREE.Color;
  private readonly tip: THREE.Color;

  constructor(colour: THREE.Color) {
    this.base = colour.clone().lerp(new THREE.Color(0xb7c98c), 0.12);
    this.tip = this.base.clone().offsetHSL(0, -0.04, 0.08);
  }

  add(start: Point, control: Point, width: number, bend: number, ridge = 0.045, end = control): void {
    const rows = 8;
    const columns = 3;
    const vertexOffset = this.positions.length / 3;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const sideX = -dy / length;
    const sideY = dx / length;
    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      const inverse = 1 - t;
      const centreX = inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x + bend * Math.sin(Math.PI * t);
      const centreY = inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y;
      const centreZ = inverse * inverse * start.z + 2 * inverse * t * control.z + t * t * end.z;
      const taperedWidth = width * Math.pow(Math.sin(Math.PI * t), 0.78);
      for (let column = 0; column <= columns; column += 1) {
        const across = (column / columns) * 2 - 1;
        this.positions.push(
          centreX + sideX * taperedWidth * across,
          centreY + sideY * taperedWidth * across,
          centreZ + ridge * Math.sin(Math.PI * t) * (1 - Math.abs(across)),
        );
        const colour = this.base.clone().lerp(this.tip, t * 0.64).multiplyScalar(0.88 + (1 - Math.abs(across)) * 0.14);
        this.colours.push(colour.r, colour.g, colour.b);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = vertexOffset + row * (columns + 1) + column;
        const b = a + columns + 1;
        this.indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }

  addPad(centre: Point, radiusX: number, radiusY: number, notchDirection: number): void {
    const rings = 4;
    const segments = 24;
    const notch = 0.62;
    const vertexOffset = this.positions.length / 3;
    for (let ring = 0; ring <= rings; ring += 1) {
      const radius = ring / rings;
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = notchDirection + notch / 2 + (segment / segments) * (Math.PI * 2 - notch);
        const x = Math.cos(angle) * radiusX * radius;
        const y = Math.sin(angle) * radiusY * radius;
        this.positions.push(
          centre.x + x,
          centre.y + y,
          centre.z + (1 - radius) * 0.045 + Math.cos(angle * 2) * 0.012 * radius,
        );
        const colour = this.base.clone().lerp(this.tip, 0.22 + radius * 0.24);
        this.colours.push(colour.r, colour.g, colour.b);
      }
    }
    for (let ring = 0; ring < rings; ring += 1) {
      for (let segment = 0; segment < segments; segment += 1) {
        const a = vertexOffset + ring * (segments + 1) + segment;
        const b = a + segments + 1;
        this.indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colours, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function stemPath(angle: number, height: number, spread: number, bend: number): Point[] {
  return Array.from({ length: 8 }, (_, index) => {
    const t = index / 7;
    const lateral = spread * t + Math.sin(Math.PI * t) * bend;
    return { x: Math.cos(angle) * lateral, y: height * t, z: Math.sin(angle) * lateral };
  });
}

function pointOnStem(path: Point[], t: number): Point {
  const position = t * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position));
  const amount = position - index;
  const first = path[index];
  const second = path[index + 1];
  return {
    x: THREE.MathUtils.lerp(first.x, second.x, amount),
    y: THREE.MathUtils.lerp(first.y, second.y, amount),
    z: THREE.MathUtils.lerp(first.z, second.z, amount),
  };
}

function addStem(root: THREE.Group, points: Point[], radius: number, material: THREE.Material): void {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 4, false), material));
}
