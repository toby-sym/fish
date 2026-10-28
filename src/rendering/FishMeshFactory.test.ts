import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { speciesById } from "../data/profiles";
import { Fish } from "../domain/entities";
import { createGenome } from "../domain/random";
import { FishMeshFactory } from "./FishMeshFactory";

describe("FishMeshFactory", () => {
  it("builds softly shaded bodies and curved profile-specific fins", () => {
    const factory = new FishMeshFactory();
    const guppy = factory.create(makeFish("guppy", 11));
    const tetra = factory.create(makeFish("neon-tetra", 22));
    const swordtail = factory.create(makeFish("swordtail", 33));

    const body = (root: THREE.Group) => root.children[0] as THREE.Mesh;
    const fin = (root: THREE.Group) => root.children[0] as THREE.Mesh;
    expect(body(guppy.root).geometry.index).not.toBeNull();
    expect(body(guppy.root).geometry.getAttribute("normal").count).toBeGreaterThan(100);
    expect(fin(guppy.tail).geometry.getAttribute("position").count).toBeGreaterThan(30);
    expect(fin(tetra.tail).geometry.getAttribute("position").count).toBeGreaterThan(30);
    fin(guppy.tail).geometry.computeBoundingBox();
    fin(tetra.tail).geometry.computeBoundingBox();
    expect(fin(guppy.tail).geometry.boundingBox?.max.y).toBeGreaterThan(fin(tetra.tail).geometry.boundingBox?.max.y ?? 0);
    expect(swordtail.tail.children).toHaveLength(2);

    for (const root of [guppy.root, tetra.root, swordtail.root]) {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    }
    factory.dispose();
  });
});

function makeFish(speciesId: string, seed: number): Fish {
  const profile = speciesById.get(speciesId);
  if (!profile) throw new Error(`Missing profile ${speciesId}.`);
  return new Fish({
    name: profile.commonName,
    speciesId: profile.id,
    speciesName: profile.commonName,
    compatibilityGroup: profile.compatibilityGroup,
    genome: createGenome(profile, seed),
  });
}
