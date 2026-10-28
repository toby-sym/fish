import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { speciesById } from "../data/profiles";
import { Fish } from "../domain/entities";
import { createGenome } from "../domain/random";
import { FishMeshFactory } from "./FishMeshFactory";

describe("FishMeshFactory", () => {
  it("builds different low-poly tail shapes from profile traits", () => {
    const factory = new FishMeshFactory();
    const guppy = factory.create(makeFish("guppy", 11));
    const tetra = factory.create(makeFish("neon-tetra", 22));
    const swordtail = factory.create(makeFish("swordtail", 33));

    const fin = (root: THREE.Group) => root.children[0] as THREE.Mesh;
    expect(fin(guppy.tail).geometry.getAttribute("position").count).toBe(12);
    expect(fin(tetra.tail).geometry.getAttribute("position").count).toBe(6);
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
