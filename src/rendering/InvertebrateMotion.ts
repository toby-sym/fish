import { seededRandom } from "../domain/random";

export interface InvertebratePosition {
  x: number;
  y: number;
  z: number;
  direction: 1 | -1;
}

/** Slow substrate grazing for snails and short, occasional darts for shrimp. */
export class InvertebrateMotion {
  private readonly random: () => number;
  private readonly position: InvertebratePosition;
  private readonly homeY: number;
  private targetX: number;
  private targetY: number;
  private retargetIn = 0;
  private burstSeconds = 0;
  private time = 0;
  private readonly speed: number;
  private width: number;

  constructor(
    seed: number,
    private readonly kind: "snail" | "shrimp",
    start: InvertebratePosition,
    width: number,
  ) {
    this.random = seededRandom(seed ^ 0x4cf5ad43);
    this.position = { ...start };
    this.homeY = start.y;
    this.width = width;
    this.speed = kind === "snail" ? 0.1 + this.random() * 0.06 : 0.22 + this.random() * 0.14;
    this.targetX = start.x + start.direction * (kind === "snail" ? 1.2 : 0.8);
    this.targetY = start.y;
  }

  update(deltaSeconds: number, width = this.width): InvertebratePosition {
    if (Number.isFinite(width) && width > 0) this.width = width;
    const maxX = Math.max(0.3, this.width / 2 - 0.45);
    this.position.x = clamp(this.position.x, -maxX, maxX);
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...this.position };
    const delta = Math.min(deltaSeconds, 0.25);
    this.time += delta;
    this.retargetIn -= delta;
    this.burstSeconds = Math.max(0, this.burstSeconds - delta);

    if (this.kind === "shrimp" && (this.retargetIn <= 0 || Math.abs(this.targetX - this.position.x) < 0.12)) {
      const limit = Math.max(0.3, this.width / 2 - 0.5);
      this.targetX = (this.random() * 2 - 1) * limit;
      this.targetY = this.homeY + this.random() * 0.75;
      this.retargetIn = 1.8 + this.random() * 2.8;
      if (this.random() < 0.34) this.burstSeconds = 0.28 + this.random() * 0.28;
    }

    if (this.kind === "snail" && (this.position.x >= maxX || this.position.x <= -maxX)) {
      this.position.direction = this.position.x >= maxX ? -1 : 1;
      this.targetX = this.position.x + this.position.direction * (0.8 + this.random() * 1.2);
    } else if (this.kind === "shrimp") {
      this.position.direction = this.targetX < this.position.x ? -1 : 1;
    }

    const speed = this.kind === "snail"
      ? this.speed
      : this.speed * (this.burstSeconds > 0 ? 3.2 : 1);
    const direction = this.kind === "snail" ? this.position.direction : Math.sign(this.targetX - this.position.x) || this.position.direction;
    this.position.x = clamp(this.position.x + direction * speed * delta, -maxX, maxX);
    if (this.kind === "shrimp") {
      this.position.y += (this.targetY - this.position.y) * Math.min(1, delta * 1.8);
      this.position.y += Math.sin(this.time * 7) * delta * 0.035;
    } else {
      this.position.y = this.homeY + Math.sin(this.time * 2.4) * 0.018;
    }
    this.position.z += (Math.sin(this.time * (this.kind === "shrimp" ? 2.8 : 1.5)) - (this.position.z - 0.15)) * delta * 0.25;
    return { ...this.position };
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
