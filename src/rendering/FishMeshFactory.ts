import * as THREE from "three";
import type { Fish } from "../domain/entities";
import type { FishTailShape, FishVisualTraits } from "../domain/types";

export interface FishMesh {
  root: THREE.Group;
  tail: THREE.Group;
  pectoralFins: [THREE.Group, THREE.Group];
}

interface BodyProfilePoint {
  x: number;
  height: number;
  depth: number;
}

const BODY_PROFILE: BodyProfilePoint[] = [
  { x: -0.55, height: 0.035, depth: 0.04 },
  { x: -0.43, height: 0.26, depth: 0.29 },
  { x: -0.24, height: 0.68, depth: 0.67 },
  { x: 0.02, height: 1, depth: 1 },
  { x: 0.28, height: 0.84, depth: 0.8 },
  { x: 0.46, height: 0.49, depth: 0.48 },
  { x: 0.55, height: 0.045, depth: 0.06 },
];

export class FishMeshFactory {
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.78,
    metalness: 0,
  });
  private readonly finMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.74,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  });
  private readonly finRayMaterial = new THREE.LineBasicMaterial({ color: 0xfff0ce, transparent: true, opacity: 0.36 });
  private readonly eyeRimMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e5bd, roughness: 0.68 });
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x172d35, roughness: 0.42 });
  private readonly eyeGlintMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x75564c, roughness: 0.9 });

  create(fish: Fish): FishMesh {
    const visual = fish.genome.visual;
    const root = new THREE.Group();
    root.userData.fishId = fish.id;

    const body = new THREE.Mesh(this.createBodyGeometry(visual), this.bodyMaterial);
    body.castShadow = false;
    body.receiveShadow = false;
    root.add(body);

    const tail = this.createTail(visual, fish.speciesId);
    const dorsalFin = this.createDorsalFin(visual);
    const analFin = this.createAnalFin(visual);
    const pectoralFins: [THREE.Group, THREE.Group] = [
      this.createPectoralFin(visual, 1),
      this.createPectoralFin(visual, -1),
    ];
    root.add(tail, dorsalFin, analFin, ...pectoralFins, this.createMouth(visual));
    this.addEyes(root, visual);

    root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.userData.fishId = fish.id;
    });

    return { root, tail, pectoralFins };
  }

  dispose(): void {
    this.bodyMaterial.dispose();
    this.finMaterial.dispose();
    this.finRayMaterial.dispose();
    this.eyeRimMaterial.dispose();
    this.eyeMaterial.dispose();
    this.eyeGlintMaterial.dispose();
    this.mouthMaterial.dispose();
  }

  private createBodyGeometry(visual: FishVisualTraits): THREE.BufferGeometry {
    const lengthScale = visual.bodyShape === "elongated" ? 1.08 : visual.bodyShape === "disc" ? 0.9 : 1;
    const heightScale = visual.bodyShape === "disc" ? 1.24 : visual.bodyShape === "deep" ? 1.12 : 1;
    const depthScale = visual.bodyShape === "deep" ? 1.07 : visual.bodyShape === "disc" ? 0.94 : 1;
    const longitudinalSegments = 20;
    const ringSegments = 14;
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const primary = new THREE.Color(visual.primaryColour);
    const secondary = new THREE.Color(visual.secondaryColour);
    const accent = new THREE.Color(visual.accentColour);
    const belly = new THREE.Color(0xf3d9ac).lerp(primary, 0.32);

    for (let longitudinalIndex = 0; longitudinalIndex <= longitudinalSegments; longitudinalIndex += 1) {
      const bodyT = longitudinalIndex / longitudinalSegments;
      const profile = sampleBodyProfile(BODY_PROFILE, bodyT);
      for (let ringIndex = 0; ringIndex < ringSegments; ringIndex += 1) {
        const angle = (ringIndex / ringSegments) * Math.PI * 2;
        const vertical = Math.sin(angle);
        const side = Math.abs(Math.cos(angle));
        positions.push(
          profile.x * visual.bodyLength * lengthScale,
          vertical * profile.height * visual.bodyHeight * heightScale,
          Math.cos(angle) * profile.depth * visual.bodyDepth * depthScale,
        );
        const colour = sampleBodyColour(visual.pattern, bodyT, vertical, side, primary, secondary, accent, belly);
        colours.push(colour.r, colour.g, colour.b);
      }
    }

    for (let longitudinalIndex = 0; longitudinalIndex < longitudinalSegments; longitudinalIndex += 1) {
      for (let ringIndex = 0; ringIndex < ringSegments; ringIndex += 1) {
        const nextRing = (ringIndex + 1) % ringSegments;
        const a = longitudinalIndex * ringSegments + ringIndex;
        const b = (longitudinalIndex + 1) * ringSegments + ringIndex;
        const c = (longitudinalIndex + 1) * ringSegments + nextRing;
        const d = longitudinalIndex * ringSegments + nextRing;
        indices.push(a, b, d, b, c, d);
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
    const group = new THREE.Group();
    group.position.x = -visual.bodyLength * 0.5;
    const length = visual.tailSize * 0.48;
    const height = visual.tailSize * 0.52;
    const shape = visual.tailShape ?? (speciesId === "swordtail" ? "sword" : "fan");
    const outline = createTailOutline(shape, length, height);
    const fin = new THREE.Mesh(this.createFinGeometry(outline, visual.secondaryColour, visual.accentColour), this.finMaterial);
    group.add(fin);
    this.addFinRays(group, length, height, 7);

    if (shape === "sword") {
      const sword = new THREE.Mesh(
        this.createFinGeometry(createSwordOutline(length), visual.accentColour, visual.secondaryColour),
        this.finMaterial,
      );
      sword.position.z = 0.035;
      group.add(sword);
    }
    return group;
  }

  private createDorsalFin(visual: FishVisualTraits): THREE.Group {
    const group = new THREE.Group();
    const fin = createRoundedFin(0.34, visual.dorsalFinSize, "dorsal");
    group.position.set(-visual.bodyLength * 0.06, visual.bodyHeight * 0.55, 0);
    group.add(new THREE.Mesh(this.createFinGeometry(fin, visual.secondaryColour, visual.accentColour), this.finMaterial));
    return group;
  }

  private createAnalFin(visual: FishVisualTraits): THREE.Group {
    const group = new THREE.Group();
    const fin = createRoundedFin(0.31, visual.dorsalFinSize * 0.62, "anal");
    group.position.set(-visual.bodyLength * 0.13, -visual.bodyHeight * 0.5, 0);
    group.add(new THREE.Mesh(this.createFinGeometry(fin, visual.secondaryColour, visual.accentColour), this.finMaterial));
    return group;
  }

  private createPectoralFin(visual: FishVisualTraits, side: 1 | -1): THREE.Group {
    const group = new THREE.Group();
    const outline = new THREE.Shape();
    outline.moveTo(0, 0.035);
    outline.quadraticCurveTo(-0.12, -0.035, -0.16, -0.2);
    outline.quadraticCurveTo(-0.08, -0.3, 0.07, -0.26);
    outline.quadraticCurveTo(0.2, -0.15, 0.11, -0.035);
    outline.quadraticCurveTo(0.04, 0.025, 0, 0.035);
    group.position.set(visual.bodyLength * 0.12, -visual.bodyHeight * 0.2, side * visual.bodyDepth * 0.78);
    group.rotation.y = side * 0.22;
    const fin = new THREE.Mesh(this.createFinGeometry(outline, visual.accentColour, visual.secondaryColour), this.finMaterial);
    fin.scale.set(0.82, 0.82, 1);
    group.add(fin);
    return group;
  }

  private createFinGeometry(shape: THREE.Shape, baseColour: number, edgeColour: number): THREE.BufferGeometry {
    const geometry = new THREE.ShapeGeometry(shape, 10);
    const positions = geometry.getAttribute("position");
    const base = new THREE.Color(baseColour);
    const edge = new THREE.Color(edgeColour);
    const colours: number[] = [];
    let maxX = 0.001;
    let maxY = 0.001;
    for (let index = 0; index < positions.count; index += 1) {
      maxX = Math.max(maxX, Math.abs(positions.getX(index)));
      maxY = Math.max(maxY, Math.abs(positions.getY(index)));
    }
    for (let index = 0; index < positions.count; index += 1) {
      const x = Math.abs(positions.getX(index)) / maxX;
      const y = Math.abs(positions.getY(index)) / maxY;
      const colour = base.clone().lerp(edge, THREE.MathUtils.clamp(x * 0.16 + y * 0.34, 0.08, 0.42));
      colours.push(colour.r, colour.g, colour.b);
      positions.setZ(index, 0.025 * (1 - Math.max(x, y)));
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private addFinRays(group: THREE.Group, length: number, height: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const spread = index / (count - 1) * 2 - 1;
      const edgeX = -length * (0.78 + Math.abs(spread) * 0.2);
      const edgeY = spread * height * (0.78 + (1 - Math.abs(spread)) * 0.14);
      const points = [
        new THREE.Vector3(0, 0, 0.032),
        new THREE.Vector3(edgeX * 0.32, edgeY * 0.28, 0.032),
        new THREE.Vector3(edgeX * 0.72, edgeY * 0.68, 0.032),
        new THREE.Vector3(edgeX, edgeY, 0.032),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, this.finRayMaterial));
    }
  }

  private createMouth(visual: FishVisualTraits): THREE.Mesh {
    const x = visual.bodyLength * 0.49;
    const mouth = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -0.025, visual.bodyDepth * 0.16),
      new THREE.Vector3(x + 0.035, -0.04, visual.bodyDepth * 0.25),
      new THREE.Vector3(x + 0.07, -0.025, visual.bodyDepth * 0.15),
    ]);
    return new THREE.Mesh(new THREE.TubeGeometry(mouth, 6, 0.006, 4, false), this.mouthMaterial);
  }

  private addEyes(root: THREE.Group, visual: FishVisualTraits): void {
    for (const side of [1, -1]) {
      const eye = new THREE.Group();
      const x = visual.bodyLength * 0.36;
      const z = side * visual.bodyDepth * 0.79;
      const rim = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), this.eyeRimMaterial);
      rim.position.set(x, 0.045, z);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 9, 7), this.eyeMaterial);
      pupil.position.set(x + 0.012, 0.047, z + side * 0.026);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), this.eyeGlintMaterial);
      glint.position.set(x + 0.023, 0.061, z + side * 0.046);
      eye.add(rim, pupil, glint);
      root.add(eye);
    }
  }

}

function sampleBodyProfile(points: BodyProfilePoint[], t: number): BodyProfilePoint {
  const location = t * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(location));
  const localT = location - index;
  const first = points[Math.max(0, index - 1)];
  const second = points[index];
  const third = points[index + 1];
  const fourth = points[Math.min(points.length - 1, index + 2)];
  return {
    x: catmullRom(first.x, second.x, third.x, fourth.x, localT),
    height: Math.max(0.015, catmullRom(first.height, second.height, third.height, fourth.height, localT)),
    depth: Math.max(0.02, catmullRom(first.depth, second.depth, third.depth, fourth.depth, localT)),
  };
}

function sampleBodyColour(
  pattern: FishVisualTraits["pattern"],
  bodyT: number,
  vertical: number,
  side: number,
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color,
  belly: THREE.Color,
): THREE.Color {
  const stripeBand = smoothStep(0.45, 0.95, side) * (1 - smoothStep(0.08, 0.56, Math.abs(vertical)));
  const bands = 1 - smoothStep(0.2, 0.68, Math.cos((bodyT * 3.4 + 0.15) * Math.PI * 2));
  const marbling = Math.sin(bodyT * Math.PI * 8 + Math.sin(vertical * 3.1) * 1.3)
    * Math.sin(vertical * 7 + bodyT * 17);
  const speckle = Math.sin(bodyT * 57 + vertical * 19) * Math.sin(vertical * 41 - bodyT * 31);
  const mottled = Math.sin(bodyT * 19 + Math.sin(vertical * 9) * 1.8) * Math.sin(vertical * 13 + bodyT * 7);
  let patternStrength = 0;
  if (pattern === "stripe") patternStrength = stripeBand * 0.12;
  if (pattern === "banded") patternStrength = bands * 0.15;
  if (pattern === "marbled") patternStrength = smoothStep(0.05, 0.86, (marbling + 1) / 2) * 0.15;
  if (pattern === "mottled") patternStrength = smoothStep(0.2, 0.92, (mottled + 1) / 2) * 0.13;
  if (pattern === "speckled") patternStrength = smoothStep(0.68, 0.96, (speckle + 1) / 2) * 0.5;

  const softSecondary = secondary.clone().lerp(primary, 0.42);
  const softAccent = accent.clone().lerp(primary, 0.34);
  const colour = primary.clone().lerp(softSecondary, patternStrength);
  const dorsalLight = smoothStep(0.05, 0.9, vertical) * 0.1;
  const bellyLight = smoothStep(0.08, 0.86, -vertical) * 0.2;
  const accentMark = pattern === "speckled" || pattern === "mottled" ? patternStrength * 0.2 : 0;
  colour.lerp(softSecondary, dorsalLight).lerp(belly, bellyLight).lerp(softAccent, accentMark);
  const softFacet = 0.99 + 0.02 * Math.sin(bodyT * 35 + vertical * 17) * Math.cos(bodyT * 18 - vertical * 23);
  return colour.multiplyScalar(softFacet);
}

function createTailOutline(shape: FishTailShape, length: number, height: number): THREE.Shape {
  const outline = new THREE.Shape();
  if (shape === "forked") {
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.25, height * 0.24, -length * 0.56, height * 0.82);
    outline.quadraticCurveTo(-length * 0.86, height * 1.08, -length, height * 0.8);
    outline.quadraticCurveTo(-length * 0.94, height * 0.34, -length * 0.68, 0);
    outline.quadraticCurveTo(-length * 0.94, -height * 0.34, -length, -height * 0.8);
    outline.quadraticCurveTo(-length * 0.86, -height * 1.08, -length * 0.56, -height * 0.82);
    outline.quadraticCurveTo(-length * 0.25, -height * 0.24, 0, 0);
  } else if (shape === "lyre") {
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.45, height * 0.2, -length * 0.68, height * 0.86);
    outline.quadraticCurveTo(-length * 1.05, height * 1.13, -length * 1.16, height * 0.96);
    outline.quadraticCurveTo(-length * 0.99, height * 0.42, -length * 0.64, 0);
    outline.quadraticCurveTo(-length * 0.99, -height * 0.42, -length * 1.16, -height * 0.96);
    outline.quadraticCurveTo(-length * 1.05, -height * 1.13, -length * 0.68, -height * 0.86);
    outline.quadraticCurveTo(-length * 0.45, -height * 0.2, 0, 0);
  } else {
    const veilScale = shape === "veil" ? 1.18 : 1;
    outline.moveTo(0, 0);
    outline.quadraticCurveTo(-length * 0.28, height * 0.18, -length * 0.54, height * 0.72 * veilScale);
    outline.quadraticCurveTo(-length * 0.84, height * 1.05 * veilScale, -length * 1.04, height * 0.75 * veilScale);
    outline.quadraticCurveTo(-length * 1.13, height * 0.38, -length * 0.9, 0);
    outline.quadraticCurveTo(-length * 1.13, -height * 0.38, -length * 1.04, -height * 0.75 * veilScale);
    outline.quadraticCurveTo(-length * 0.84, -height * 1.05 * veilScale, -length * 0.54, -height * 0.72 * veilScale);
    outline.quadraticCurveTo(-length * 0.28, -height * 0.18, 0, 0);
  }
  return outline;
}

function createSwordOutline(length: number): THREE.Shape {
  const outline = new THREE.Shape();
  outline.moveTo(0, -0.025);
  outline.quadraticCurveTo(-length * 0.85, -0.02, -length * 1.6, -0.085);
  outline.quadraticCurveTo(-length * 1.25, 0, 0, 0.025);
  outline.closePath();
  return outline;
}

function createRoundedFin(width: number, height: number, orientation: "dorsal" | "anal"): THREE.Shape {
  const sign = orientation === "dorsal" ? 1 : -1;
  const outline = new THREE.Shape();
  outline.moveTo(-width * 0.5, sign * 0.015);
  outline.quadraticCurveTo(-width * 0.16, sign * height * 0.65, width * 0.1, sign * height * 0.94);
  outline.quadraticCurveTo(width * 0.25, sign * height * 1.04, width * 0.32, sign * height * 0.85);
  outline.quadraticCurveTo(width * 0.48, sign * height * 0.5, width * 0.5, sign * 0.025);
  outline.closePath();
  return outline;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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
