import type { MotionBounds } from "./FishMotion";

export interface FeedingPosition {
  x: number;
  y: number;
  z: number;
}

/** A fish investigates a small patch near the surface where the flakes enter. */
export function feedingSurfaceTarget(
  position: FeedingPosition,
  bounds: MotionBounds,
  random: () => number,
): FeedingPosition {
  const padding = bounds.padding ?? 0.7;
  const maxX = Math.max(0, bounds.width / 2 - padding);
  const maxY = Math.max(0, bounds.height / 2 - padding);
  return {
    x: clamp(position.x + (random() - 0.5) * 0.7, -maxX, maxX),
    y: Math.max(0, maxY - 0.35),
    z: position.z,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
