import { seededRandom } from "../domain/random";

export type InvertebrateKind = "snail" | "shrimp";

export interface InvertebratePosition {
  x: number;
  y: number;
  z: number;
  direction: 1 | -1;
}

export class InvertebrateMotion {
  private readonly random: () => number;
  private readonly position: InvertebratePosition;
  private targetX: number;
  private velocityX = 0;
  private waypointTimer = 0;
  private readonly speed: number;
  private readonly floorY: number;

  constructor(seed: number, private readonly kind: InvertebrateKind, start: InvertebratePosition, width: number) {
    this.random = seededRandom(seed ^ 0x31f2e52a);
    this.position = { ...start };
    this.floorY = start.y;
    this.speed = kind === "shrimp" ? 0.32 + this.random() * 0.12 : 0.065 + this.random() * 0.04;
    this.targetX = start.x;
    this.chooseWaypoint(width);
  }

  update(deltaSeconds: number, width: number): InvertebratePosition {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...this.position };
    const delta = Math.min(deltaSeconds, 0.25);
    const halfWidth = Math.max(0.2, width / 2 - 0.5);
    this.waypointTimer -= delta;
    const distance = this.targetX - this.position.x;
    if (this.waypointTimer <= 0 || Math.abs(distance) < 0.08) this.chooseWaypoint(width);

    const remaining = this.targetX - this.position.x;
    const desiredVelocity = Math.sign(remaining) * this.speed * Math.min(1, Math.abs(remaining) / 0.45);
    const response = Math.min(1, delta * (this.kind === "shrimp" ? 2.8 : 1.1));
    this.velocityX += (desiredVelocity - this.velocityX) * response;
    this.position.x = clamp(this.position.x + this.velocityX * delta, -halfWidth, halfWidth);
    this.position.direction = this.velocityX < -0.015 ? -1 : this.velocityX > 0.015 ? 1 : this.position.direction;
    this.position.y = this.floorY + (this.kind === "shrimp" ? Math.sin(this.waypointTimer * 2.2) * 0.035 : 0);
    if (Math.abs(this.position.x) >= halfWidth - 0.02) this.chooseWaypoint(width);
    return { ...this.position };
  }

  private chooseWaypoint(width: number): void {
    const halfWidth = Math.max(0.2, width / 2 - 0.5);
    this.targetX = (this.random() * 2 - 1) * halfWidth;
    this.waypointTimer = this.kind === "shrimp" ? 2.8 + this.random() * 3.8 : 6 + this.random() * 9;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
