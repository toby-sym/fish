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

    const body = guppy.root.children[0] as THREE.Mesh;
    expect(body.geometry.getAttribute("position").count).toBeGreaterThan(250);
    expect(body.geometry.getAttribute("color").count).toBe(body.geometry.getAttribute("position").count);
    expect((body.material as THREE.MeshStandardMaterial).flatShading).toBe(false);
    expect(guppy.tail.children.filter((child) => child instanceof THREE.Mesh)).toHaveLength(1);
    expect(tetra.tail.children.filter((child) => child instanceof THREE.Mesh)).toHaveLength(1);
    expect(swordtail.tail.children.filter((child) => child instanceof THREE.Mesh)).toHaveLength(2);
    expect(guppy.pectoralFins).toHaveLength(2);

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
