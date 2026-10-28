import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Plant } from "../domain/entities";
import type { PlantGrowthForm } from "../domain/types";
import { PlantMeshFactory } from "./PlantMeshFactory";

const growthForms: PlantGrowthForm[] = ["fern", "broad-leaf", "stem", "ribbon", "rosette", "floating"];

function makePlant(growthForm: PlantGrowthForm, seed = 42): Plant {
  return new Plant({
    name: growthForm,
    speciesId: growthForm,
    nitrateUptakePerMinute: 0.01,
    oxygenProductionPerMinute: 0.01,
    visualSeed: seed,
    colour: 0x5d9c68,
    growthForm,
  });
}

describe("PlantMeshFactory", () => {
  it("builds curved indexed leaf surfaces for each growth form", () => {
    const factory = new PlantMeshFactory();

    for (const growthForm of growthForms) {
      const root = factory.create(makePlant(growthForm));
      const leaves = root.children[root.children.length - 1] as THREE.Mesh;
      const geometry = leaves.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");

      expect(geometry.index?.count).toBeGreaterThan(600);
      expect(positions.count).toBeGreaterThanOrEqual(200);
      expect(normals.count).toBe(positions.count);
      expect([...normals.array].every(Number.isFinite)).toBe(true);
      if (growthForm === "floating") {
        geometry.computeBoundingBox();
        expect(geometry.boundingBox?.max.y).toBeGreaterThan(8);
      }
    }
  });

  it("generates identical geometry from the same plant seed", () => {
    const factory = new PlantMeshFactory();
    const first = factory.create(makePlant("fern", 991));
    const second = factory.create(makePlant("fern", 991));
    const firstGeometry = (first.children.at(-1) as THREE.Mesh).geometry as THREE.BufferGeometry;
    const secondGeometry = (second.children.at(-1) as THREE.Mesh).geometry as THREE.BufferGeometry;

    expect([...firstGeometry.getAttribute("position").array]).toEqual([...secondGeometry.getAttribute("position").array]);
    expect([...firstGeometry.index!.array]).toEqual([...secondGeometry.index!.array]);
  });
});
