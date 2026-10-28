import { describe, expect, it } from "vitest";
import { layoutPlantPositions } from "./PlantLayout";

describe("layoutPlantPositions", () => {
  it("preserves the authored layout when there is room", () => {
    expect(layoutPlantPositions([-3.1, -1.75, 1.55, 3], 17.8)).toEqual([-3.1, -1.75, 1.55, 3]);
  });

  it("spreads crowded plants across a narrow portrait view", () => {
    const positions = layoutPlantPositions([-3.1, -1.75, 1.55, 3], 6.4);

    expect(positions).toHaveLength(4);
    positions.forEach((position, index) => expect(position).toBeCloseTo([-2, -2 / 3, 2 / 3, 2][index]));
  });

  it("keeps a lone plant within bounds and returns an empty layout without plants", () => {
    expect(layoutPlantPositions([3.5], 6.4)).toEqual([2]);
    expect(layoutPlantPositions([], 6.4)).toEqual([]);
  });
});
