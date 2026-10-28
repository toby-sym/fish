/** Keeps plant silhouettes readable when a tall wallpaper gives them little horizontal room. */
export function layoutPlantPositions(
  sourcePositions: number[],
  viewportWidth: number,
  horizontalInset = 1.2,
  minimumSpacing = 1.15,
): number[] {
  if (sourcePositions.length === 0) return [];

  const maximumX = Math.max(0, viewportWidth / 2 - horizontalInset);
  const sorted = sourcePositions
    .map((x, index) => ({ x: clamp(x, -maximumX, maximumX), index }))
    .sort((first, second) => first.x - second.x);
  const crowded = sorted.some((plant, index) => index > 0 && plant.x - sorted[index - 1].x < minimumSpacing);
  const positions = crowded
    ? spreadAcrossWidth(sorted.length, maximumX)
    : sorted.map((plant) => plant.x);
  const result = Array<number>(sourcePositions.length);
  sorted.forEach((plant, index) => { result[plant.index] = positions[index]; });
  return result;
}

function spreadAcrossWidth(count: number, maximumX: number): number[] {
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => -maximumX + (2 * maximumX * index) / (count - 1));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
