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
    flatShading: true,
    roughness: 0.84,
    metalness: 0,
  });
  private readonly finMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x10262a, roughness: 0.38 });
  private readonly eyeGlintMaterial = new THREE.MeshBasicMaterial({ color: 0xeaf8dc });

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
  }

  private createBodyGeometry(visual: FishVisualTraits, random: () => number): THREE.BufferGeometry {
    const length = visual.bodyLength;
    const height = visual.bodyHeight;
    const depth = visual.bodyDepth;
    const slices = [
      { x: -0.54, y: 0.08, z: 0.07 },
      { x: -0.29, y: 0.67, z: 0.65 },
      { x: 0.08, y: 1, z: 1 },
      { x: 0.37, y: 0.7, z: 0.68 },
      { x: 0.55, y: 0.13, z: 0.16 },
    ];
    const shape = visual.bodyShape ?? "streamlined";
    const shapeScale = shape === "elongated"
      ? { length: 1.1, height: 0.76, depth: 0.78 }
      : shape === "disc"
        ? { length: 0.91, height: 1.28, depth: 0.92 }
        : shape === "deep"
          ? { length: 0.96, height: 1.12, depth: 1.06 }
          : { length: 1, height: 1, depth: 1 };
    const ringSegments = 6;
    const positions: number[] = [];
    const colours: number[] = [];
    const palette = [visual.primaryColour, visual.secondaryColour, visual.accentColour];

    const point = (sliceIndex: number, ringIndex: number): [number, number, number] => {
      const slice = slices[sliceIndex];
      const angle = (ringIndex / ringSegments) * Math.PI * 2;
      return [
        slice.x * length * shapeScale.length,
        Math.sin(angle) * slice.y * height * shapeScale.height,
        Math.cos(angle) * slice.z * depth * shapeScale.depth,
      ];
    };

    const addTriangle = (a: number[], b: number[], c: number[], colour: number) => {
      const converted = new THREE.Color(colour);
      for (const vertex of [a, b, c]) {
        positions.push(vertex[0], vertex[1], vertex[2]);
        colours.push(converted.r, converted.g, converted.b);
      }
    };

    for (let sliceIndex = 0; sliceIndex < slices.length - 1; sliceIndex += 1) {
      for (let ringIndex = 0; ringIndex < ringSegments; ringIndex += 1) {
        const nextRing = (ringIndex + 1) % ringSegments;
        let colourIndex = random() < 0.22 ? 1 : 0;
        if (visual.pattern === "stripe" && (sliceIndex === 1 || sliceIndex === 3)) colourIndex = 1;
        if (visual.pattern === "banded" && sliceIndex % 2 === 1) colourIndex = 1;
        if (visual.pattern === "mottled" && random() < 0.27) colourIndex = 2;
        if (visual.pattern === "speckled" && random() < 0.34) colourIndex = 2;
        if (visual.pattern === "marbled" && random() < 0.4) colourIndex = random() < 0.5 ? 1 : 2;
        const colour = palette[colourIndex];
        const a = point(sliceIndex, ringIndex);
        const b = point(sliceIndex + 1, ringIndex);
        const c = point(sliceIndex + 1, nextRing);
        const d = point(sliceIndex, nextRing);
        addTriangle(a, b, c, colour);
        addTriangle(a, c, d, random() < 0.17 ? visual.accentColour : colour);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
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
    const triangles = shape === "forked"
      ? [
        { points: [[0, 0, 0], [-tailLength, tailHeight * 0.82, 0], [-tailLength * 0.65, 0, 0]] as number[][], colour: visual.secondaryColour },
        { points: [[0, 0, 0], [-tailLength * 0.65, 0, 0], [-tailLength, -tailHeight * 0.82, 0]] as number[][], colour: visual.accentColour },
      ]
      : shape === "lyre"
        ? [
          { points: [[0, 0, 0], [-tailLength * 1.08, tailHeight, 0], [-tailLength * 0.62, 0, 0]] as number[][], colour: visual.secondaryColour },
          { points: [[0, 0, 0], [-tailLength * 0.62, 0, 0], [-tailLength * 1.08, -tailHeight, 0]] as number[][], colour: visual.accentColour },
        ]
        : shape === "veil"
          ? [
            { points: [[0, 0, 0], [-tailLength, tailHeight, 0], [-tailLength * 0.72, 0, 0]] as number[][], colour: visual.secondaryColour },
            { points: [[0, 0, 0], [-tailLength * 0.72, 0, 0], [-tailLength, -tailHeight, 0]] as number[][], colour: visual.accentColour },
            { points: [[0, 0, 0], [-tailLength * 0.82, tailHeight * 0.72, 0.015], [-tailLength * 0.94, 0, 0.015]] as number[][], colour: visual.accentColour },
            { points: [[0, 0, 0], [-tailLength * 0.94, 0, 0.015], [-tailLength * 0.82, -tailHeight * 0.72, 0.015]] as number[][], colour: visual.secondaryColour },
          ]
          : [
            { points: [[0, 0, 0], [-tailLength, tailHeight, 0], [-tailLength * 0.92, 0, 0]] as number[][], colour: visual.secondaryColour },
            { points: [[0, 0, 0], [-tailLength * 0.92, 0, 0], [-tailLength, -tailHeight, 0]] as number[][], colour: visual.accentColour },
          ];
    tail.add(new THREE.Mesh(this.triangleGeometry(triangles), this.finMaterial));

    if (shape === "sword") {
      const sword = new THREE.Mesh(
        this.triangleGeometry([{
          points: [[0, -0.04, 0.015], [-tailLength * 1.7, -0.07, 0.015], [0, -0.015, 0.015]],
          colour: visual.accentColour,
        }]),
        this.finMaterial,
      );
      tail.add(sword);
    }
    return tail;
  }

  private createDorsalFin(visual: FishVisualTraits): THREE.Mesh {
    const span = visual.dorsalFinSize;
    const geometry = this.triangleGeometry([
      { points: [[-0.08, visual.bodyHeight * 0.65, 0], [0.08, visual.bodyHeight + span, 0], [0.19, visual.bodyHeight * 0.72, 0]], colour: visual.accentColour },
      { points: [[0.08, visual.bodyHeight + span, 0], [0.3, visual.bodyHeight * 0.64, 0], [0.19, visual.bodyHeight * 0.72, 0]], colour: visual.secondaryColour },
    ]);
    return new THREE.Mesh(geometry, this.finMaterial);
  }

  private createPectoralFin(visual: FishVisualTraits, side: 1 | -1): THREE.Mesh {
    const geometry = this.triangleGeometry([{
      points: [[0.05, -0.04, side * visual.bodyDepth * 0.68], [-0.04, -0.24, side * visual.bodyDepth], [0.24, -0.15, side * visual.bodyDepth * 0.75]],
      colour: visual.accentColour,
    }]);
    return new THREE.Mesh(geometry, this.finMaterial);
  }

  private addEyes(root: THREE.Group, visual: FishVisualTraits): void {
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 4), this.eyeMaterial);
      eye.position.set(visual.bodyLength * 0.37, 0.04, side * visual.bodyDepth * 0.78);
      root.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 4, 3), this.eyeGlintMaterial);
      glint.position.set(eye.position.x + 0.012, eye.position.y + 0.014, eye.position.z + side * 0.035);
      root.add(glint);
    }
  }

  private triangleGeometry(triangles: Array<{ points: number[][]; colour: number }>): THREE.BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    for (const triangle of triangles) {
      const converted = new THREE.Color(triangle.colour);
      for (const vertex of triangle.points) {
        positions.push(vertex[0], vertex[1], vertex[2]);
        colours.push(converted.r, converted.g, converted.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
