import { seededRandom } from "../domain/random";

export interface MotionBounds {
  width: number;
  height: number;
  padding?: number;
}

export interface FishPosition {
  x: number;
  y: number;
  z: number;
  direction: 1 | -1;
  pitch: number;
}

export interface SchoolCenter {
  x: number;
  y: number;
}

/** Seeded waypoint steering keeps each fish's movement varied and reproducible. */
export class FishMotion {
  private readonly random: () => number;
  private readonly position: FishPosition;
  private readonly target = { x: 0, y: 0, z: 0 };
  private velocityX = 0;
  private velocityY = 0;
  private waypointTimer = 0;
  private readonly speed: number;
  private foodTarget?: { x: number; y: number; z: number; remainingSeconds: number };

  constructor(seed: number, bounds: MotionBounds) {
    this.random = seededRandom(seed ^ 0x6d2b79f5);
    this.speed = 1 + this.random() * 0.8;
    this.position = {
      x: this.random() * this.axisLimit(bounds.width, bounds.padding ?? 0.7) * 2 - this.axisLimit(bounds.width, bounds.padding ?? 0.7),
      y: this.random() * this.axisLimit(bounds.height, bounds.padding ?? 0.7) * 2 - this.axisLimit(bounds.height, bounds.padding ?? 0.7),
      z: (this.random() - 0.5) * 2.6,
      direction: this.random() < 0.5 ? -1 : 1,
      pitch: 0,
    };
    this.chooseWaypoint(bounds);
  }

  update(deltaSeconds: number, bounds: MotionBounds, schoolCenter?: SchoolCenter): FishPosition {
    const maxX = this.axisLimit(bounds.width, bounds.padding ?? 0.7);
    const maxY = this.axisLimit(bounds.height, bounds.padding ?? 0.7);
    this.position.x = clamp(this.position.x, -maxX, maxX);
    this.position.y = clamp(this.position.y, -maxY, maxY);
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...this.position };

    const delta = Math.min(deltaSeconds, 0.25);
    if (this.foodTarget) {
      this.foodTarget.remainingSeconds -= delta;
      if (this.foodTarget.remainingSeconds <= 0) {
        this.foodTarget = undefined;
        this.chooseWaypoint(bounds);
      } else {
        this.target.x = this.foodTarget.x;
        this.target.y = this.foodTarget.y;
        this.target.z = this.foodTarget.z;
      }
    } else {
      this.waypointTimer -= delta;
      const dx = this.target.x - this.position.x;
      const dy = this.target.y - this.position.y;
      if (this.waypointTimer <= 0 || Math.hypot(dx, dy) < 0.18) this.chooseWaypoint(bounds);
    }

    const schoolFactor = schoolCenter && !this.foodTarget ? 0.28 : 1;
    const aimX = schoolCenter && !this.foodTarget
      ? schoolCenter.x + (this.target.x - schoolCenter.x) * schoolFactor
      : this.target.x;
    const aimY = schoolCenter && !this.foodTarget
      ? schoolCenter.y + (this.target.y - schoolCenter.y) * schoolFactor
      : this.target.y;
    const targetX = aimX - this.position.x;
    const targetY = aimY - this.position.y;
    const distance = Math.max(0.001, Math.hypot(targetX, targetY));
    const speed = this.speed * Math.min(1, distance / 0.75);
    const steering = Math.min(1, delta * 1.8);
    this.velocityX += (targetX / distance * speed - this.velocityX) * steering;
    this.velocityY += (targetY / distance * speed - this.velocityY) * steering;
    this.position.x = clamp(this.position.x + this.velocityX * delta, -maxX, maxX);
    this.position.y = clamp(this.position.y + this.velocityY * delta, -maxY, maxY);
    this.position.z += (this.target.z - this.position.z) * Math.min(1, delta * 0.35);
    if (Math.abs(this.velocityX) > 0.025) this.position.direction = this.velocityX < 0 ? -1 : 1;
    this.position.pitch = clamp(Math.atan2(this.velocityY, Math.max(0.08, Math.abs(this.velocityX))) * 0.42, -0.2, 0.2);

    if (!this.foodTarget && (Math.abs(this.target.x) > maxX || Math.abs(this.target.y) > maxY)) {
      this.chooseWaypoint(bounds);
    }
    return { ...this.position };
  }

  feedAt(point: { x: number; y: number; z: number }, bounds: MotionBounds, durationSeconds = 4): void {
    const maxX = this.axisLimit(bounds.width, bounds.padding ?? 0.7);
    const maxY = this.axisLimit(bounds.height, bounds.padding ?? 0.7);
    this.foodTarget = {
      x: clamp(point.x, -maxX, maxX),
      y: clamp(point.y, -maxY, maxY),
      z: point.z,
      remainingSeconds: Math.max(0, durationSeconds),
    };
    this.target.x = this.foodTarget.x;
    this.target.y = this.foodTarget.y;
    this.target.z = this.foodTarget.z;
  }

  private chooseWaypoint(bounds: MotionBounds): void {
    const padding = bounds.padding ?? 0.7;
    const maxX = this.axisLimit(bounds.width, padding);
    const maxY = this.axisLimit(bounds.height, padding);
    this.target.x = (this.random() * 2 - 1) * maxX;
    this.target.y = (this.random() * 2 - 1) * maxY;
    this.target.z = (this.random() - 0.5) * 2.6;
    const distance = Math.hypot(this.target.x - this.position.x, this.target.y - this.position.y);
    this.waypointTimer = Math.max(3, distance / (this.speed * 0.62) + 1 + this.random() * 1.5);
  }

  private axisLimit(size: number, padding: number): number {
    return Math.max(0, size / 2 - padding);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
