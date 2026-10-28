import * as THREE from "three";
import type { Fish } from "../domain/entities";
import { seededRandom } from "../domain/random";
import type { FishVisualTraits } from "../domain/types";

export interface FishMesh {
  root: THREE.Group;
  tail: THREE.Group;
}

export class FishMeshFactory {
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.92,
    metalness: 0,
  });
  private readonly finMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x10262a, roughness: 0.38 });
  private readonly eyeGlintMaterial = new THREE.MeshBasicMaterial({ color: 0xeaf8dc });
  private readonly mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x43695f, roughness: 0.78 });

  create(fish: Fish): FishMesh {
    const visual = fish.genome.visual;
    const random = seededRandom(visual.seed);
    const root = new THREE.Group();
    root.userData.fishId = fish.id;

    const body = new THREE.Mesh(this.createBodyGeometry(visual, random), this.bodyMaterial);
    body.castShadow = false;
    body.receiveShadow = false;
    root.add(body);

    const tail = this.createTail(visual, fish.speciesId);
    root.add(tail);
    root.add(this.createDorsalFin(visual));
    root.add(this.createPectoralFin(visual, 1));
    root.add(this.createPectoralFin(visual, -1));
    root.add(this.createMouth(visual));
    this.addEyes(root, visual);

    const juvenileScale = fish.lifeStage === "juvenile" ? 0.58 : 1;
    root.scale.setScalar(juvenileScale);
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.userData.fishId = fish.id;
    });

    return { root, tail };
  }

  dispose(): void {
    this.bodyMaterial.dispose();
    this.finMaterial.dispose();
    this.eyeMaterial.dispose();
    this.eyeGlintMaterial.dispose();
    this.mouthMaterial.dispose();
  }

  private createBodyGeometry(visual: FishVisualTraits, random: () => number): THREE.BufferGeometry {
    const length = visual.bodyLength;
    const height = visual.bodyHeight;
    const depth = visual.bodyDepth;
    const controls = [
      { x: -0.54, y: 0.025, z: 0.025 },
      { x: -0.42, y: 0.3, z: 0.35 },
      { x: -0.25, y: 0.72, z: 0.72 },
      { x: 0.02, y: 1, z: 1 },
      { x: 0.29, y: 0.82, z: 0.77 },
      { x: 0.46, y: 0.46, z: 0.4 },
      { x: 0.55, y: 0.04, z: 0.04 },
    ];
    const shape = visual.bodyShape ?? "streamlined";
    const shapeScale = shape === "elongated"
      ? { length: 1.1, height: 0.76, depth: 0.78 }
      : shape === "disc"
        ? { length: 0.91, height: 1.28, depth: 0.92 }
        : shape === "deep"
          ? { length: 0.96, height: 1.12, depth: 1.06 }
          : { length: 1, height: 1, depth: 1 };
    const longitudinalSegments = 20;
    const ringSegments = 12;
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const primary = new THREE.Color(visual.primaryColour);
    const secondary = new THREE.Color(visual.secondaryColour);
    const accent = new THREE.Color(visual.accentColour);

    for (let longitudinalIndex = 0; longitudinalIndex <= longitudinalSegments; longitudinalIndex += 1) {
      const bodyT = longitudinalIndex / longitudinalSegments;
      const profile = sampleBodyProfile(controls, bodyT);
      for (let ringIndex = 0; ringIndex < ringSegments; ringIndex += 1) {
        const angle = (ringIndex / ringSegments) * Math.PI * 2;
        const side = Math.cos(angle);
        const vertical = Math.sin(angle);
        positions.push(
          profile.x * length * shapeScale.length,
          vertical * profile.y * height * shapeScale.height,
          side * profile.z * depth * shapeScale.depth,
        );

        const bodyColour = fishSurfaceColour(visual.pattern, bodyT, angle, primary, secondary, accent);
        const gentleShade = 0.98 + random() * 0.04;
        bodyColour.multiplyScalar(gentleShade);
        colours.push(bodyColour.r, bodyColour.g, bodyColour.b);
      }
    }

    for (let longitudinalIndex = 0; longitudinalIndex < longitudinalSegments; longitudinalIndex += 1) {
      for (let ringIndex = 0; ringIndex < ringSegments; ringIndex += 1) {
        const nextRing = (ringIndex + 1) % ringSegments;
        const a = longitudinalIndex * ringSegments + ringIndex;
        const b = (longitudinalIndex + 1) * ringSegments + ringIndex;
        const c = (longitudinalIndex + 1) * ringSegments + nextRing;
        const d = longitudinalIndex * ringSegments + nextRing;
        indices.push(a, b, c, a, c, d);
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

  private createTail(visual: FishVisualTraits, speciesId: string): THREE.Group {
    const tail = new THREE.Group();
    tail.position.x = -visual.bodyLength * 0.52;
    const tailLength = 0.45 * visual.tailSize;
    const tailHeight = 0.46 * visual.tailSize;
    const shape = visual.tailShape ?? (speciesId === "swordtail" ? "sword" : "fan");
    tail.add(new THREE.Mesh(
      createTailGeometry(shape, tailLength, tailHeight, visual.secondaryColour, visual.accentColour),
      this.finMaterial,
    ));

    if (shape === "sword") {
      const sword = new THREE.Mesh(createSwordGeometry(tailLength, visual.accentColour), this.finMaterial);
      tail.add(sword);
    }
    return tail;
  }

  private createDorsalFin(visual: FishVisualTraits): THREE.Mesh {
    const span = visual.dorsalFinSize;
    const outline = new THREE.Shape();
    outline.moveTo(-0.08, visual.bodyHeight * 0.65);
    outline.quadraticCurveTo(-0.02, visual.bodyHeight + span * 0.82, 0.11, visual.bodyHeight + span);
    outline.quadraticCurveTo(0.25, visual.bodyHeight + span * 0.72, 0.3, visual.bodyHeight * 0.64);
    outline.lineTo(0.2, visual.bodyHeight * 0.68);
    outline.quadraticCurveTo(0.04, visual.bodyHeight * 0.62, -0.08, visual.bodyHeight * 0.65);
    const geometry = colourFin(new THREE.ShapeGeometry(outline, 8), visual.secondaryColour, visual.accentColour);
    return new THREE.Mesh(geometry, this.finMaterial);
  }

  private createPectoralFin(visual: FishVisualTraits, side: 1 | -1): THREE.Mesh {
    const outline = new THREE.Shape();
    outline.moveTo(0.05, -0.035);
    outline.quadraticCurveTo(-0.14, -0.2, -0.04, -0.31);
    outline.quadraticCurveTo(0.16, -0.27, 0.25, -0.13);
    outline.quadraticCurveTo(0.18, -0.07, 0.05, -0.035);
    const geometry = colourFin(new THREE.ShapeGeometry(outline, 8), visual.accentColour, visual.secondaryColour);
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      positions.setZ(index, side * visual.bodyDepth * 0.78);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, this.finMaterial);
  }

  private createMouth(visual: FishVisualTraits): THREE.Mesh {
    const points = [
      new THREE.Vector3(visual.bodyLength * 0.47, -visual.bodyHeight * 0.12, visual.bodyDepth * 0.48),
      new THREE.Vector3(visual.bodyLength * 0.51, -visual.bodyHeight * 0.16, visual.bodyDepth * 0.49),
      new THREE.Vector3(visual.bodyLength * 0.54, -visual.bodyHeight * 0.1, visual.bodyDepth * 0.34),
    ];
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 6, 0.007, 4, false);
    return new THREE.Mesh(geometry, this.mouthMaterial);
  }

  private addEyes(root: THREE.Group, visual: FishVisualTraits): void {
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.eyeMaterial);
      eye.position.set(visual.bodyLength * 0.37, 0.04, side * visual.bodyDepth * 0.78);
      root.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), this.eyeGlintMaterial);
      glint.position.set(eye.position.x + 0.012, eye.position.y + 0.014, eye.position.z + side * 0.035);
      root.add(glint);
    }
  }

}

interface BodyProfilePoint {
  x: number;
  y: number;
  z: number;
}

function sampleBodyProfile(controls: BodyProfilePoint[], t: number): BodyProfilePoint {
  const position = t * (controls.length - 1);
  const index = Math.min(controls.length - 2, Math.floor(position));
  const localT = position - index;
  const first = controls[Math.max(0, index - 1)];
  const second = controls[index];
  const third = controls[index + 1];
  const fourth = controls[Math.min(controls.length - 1, index + 2)];
  return {
    x: catmullRom(first.x, second.x, third.x, fourth.x, localT),
    y: catmullRom(first.y, second.y, third.y, fourth.y, localT),
    z: catmullRom(first.z, second.z, third.z, fourth.z, localT),
  };
}

function catmullRom(first: number, second: number, third: number, fourth: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * second
    + (-first + third) * t
    + (2 * first - 5 * second + 4 * third - fourth) * t2
    + (-first + 3 * second - 3 * third + fourth) * t3
  );
}

function fishSurfaceColour(
  pattern: FishVisualTraits["pattern"],
  bodyT: number,
  angle: number,
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color,
): THREE.Color {
  const sideBand = 1 - smoothStep(0.16, 0.32, Math.abs(Math.sin(angle)));
  const bandedMark = smoothStep(0.2, 0.7, Math.cos((bodyT * 3.5 + 0.15) * Math.PI * 2));
  const mottledNoise = Math.sin(bodyT * 17 + Math.sin(angle * 3) * 1.7)
    * Math.sin(angle * 4.5 + bodyT * 12);
  const marbledWave = Math.sin(bodyT * Math.PI * 7 + Math.sin(angle * 2.5) * 1.6);
  const speckleNoise = Math.sin(bodyT * 39 + Math.cos(angle * 7) * 2.2)
    * Math.sin(angle * 13 + bodyT * 26);
  const colour = primary.clone();

  if (pattern === "stripe") colour.lerp(secondary, sideBand * 0.58);
  if (pattern === "banded") colour.lerp(secondary, bandedMark * 0.64);
  if (pattern === "mottled") colour.lerp(accent, smoothStep(0.42, 0.96, mottledNoise) * 0.42);
  if (pattern === "speckled") colour.lerp(accent, smoothStep(0.84, 0.99, speckleNoise) * 0.62);
  if (pattern === "marbled") colour.lerp(secondary, (0.12 + (marbledWave + 1) * 0.15));

  const bellyShade = smoothStep(-0.9, -0.15, Math.sin(angle)) * 0.05;
  return colour.multiplyScalar(1 - bellyShade);
}

function createTailGeometry(
  shape: NonNullable<FishVisualTraits["tailShape"]>,
  length: number,
  height: number,
  secondaryColour: number,
  accentColour: number,
): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  if (shape === "forked") {
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.42, height * 0.26, -length * 0.67, height * 0.7);
    outline.quadraticCurveTo(-length * 1.05, height * 0.88, -length, height * 0.34);
    outline.quadraticCurveTo(-length * 0.91, height * 0.1, -length * 0.62, 0);
    outline.quadraticCurveTo(-length * 0.91, -height * 0.1, -length, -height * 0.34);
    outline.quadraticCurveTo(-length * 1.05, -height * 0.88, -length * 0.67, -height * 0.7);
    outline.quadraticCurveTo(-length * 0.42, -height * 0.26, 0, 0);
  } else if (shape === "lyre") {
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.42, height * 0.22, -length * 0.55, height * 0.72);
    outline.quadraticCurveTo(-length * 0.95, height * 1.2, -length * 1.18, height * 0.98);
    outline.quadraticCurveTo(-length * 1.03, height * 0.43, -length * 0.68, 0);
    outline.quadraticCurveTo(-length * 1.03, -height * 0.43, -length * 1.18, -height * 0.98);
    outline.quadraticCurveTo(-length * 0.95, -height * 1.2, -length * 0.55, -height * 0.72);
    outline.quadraticCurveTo(-length * 0.42, -height * 0.22, 0, 0);
  } else {
    const fanScale = shape === "veil" ? 1.2 : 1;
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.32, height * 0.18, -length * 0.55, height * 0.66 * fanScale);
    outline.quadraticCurveTo(-length * 0.79, height * 1.02 * fanScale, -length * 1.03, height * 0.78 * fanScale);
    outline.quadraticCurveTo(-length * 1.12, height * 0.48 * fanScale, -length * 0.92, 0);
    outline.quadraticCurveTo(-length * 1.12, -height * 0.48 * fanScale, -length * 1.03, -height * 0.78 * fanScale);
    outline.quadraticCurveTo(-length * 0.79, -height * 1.02 * fanScale, -length * 0.55, -height * 0.66 * fanScale);
    outline.quadraticCurveTo(-length * 0.32, -height * 0.18, 0, 0);
  }
  return colourFin(new THREE.ShapeGeometry(outline, 12), secondaryColour, accentColour);
}

function createSwordGeometry(length: number, colour: number): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(0, -0.035);
  outline.quadraticCurveTo(-length * 0.85, -0.035, -length * 1.62, -0.105);
  outline.quadraticCurveTo(-length * 1.25, -0.015, 0, 0.015);
  outline.closePath();
  return colourFin(new THREE.ShapeGeometry(outline, 6), colour, colour);
}

function colourFin(geometry: THREE.BufferGeometry, baseColour: number, edgeColour: number): THREE.BufferGeometry {
  const positions = geometry.getAttribute("position");
  const colours: number[] = [];
  const base = new THREE.Color(baseColour);
  const edge = new THREE.Color(edgeColour);
  let maxY = 0.01;
  let maxX = 0.01;
  for (let index = 0; index < positions.count; index += 1) {
    maxY = Math.max(maxY, Math.abs(positions.getY(index)));
    maxX = Math.max(maxX, Math.abs(positions.getX(index)));
  }
  for (let index = 0; index < positions.count; index += 1) {
    const y = Math.abs(positions.getY(index)) / maxY;
    const x = Math.abs(positions.getX(index)) / maxX;
    const edgeDistance = clamp(Math.max(x, y), 0, 1);
    positions.setZ(index, 0.035 * (1 - edgeDistance));
    const colour = base.clone().lerp(edge, clamp(y * 0.22 + x * 0.18, 0.08, 0.4));
    colours.push(colour.r, colour.g, colour.b);
  }
  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
