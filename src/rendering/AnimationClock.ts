/** Advances scene animation only by time spent in active render frames. */
export class AnimationClock {
  private elapsedSeconds = 0;

  advance(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return this.elapsedSeconds;
    this.elapsedSeconds += Math.min(deltaSeconds, 0.25);
    return this.elapsedSeconds;
  }
}
