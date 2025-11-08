/**
 * Turkey AI with Ornstein-Uhlenbeck Velocity Process
 * Smooth correlated motion in R^4 using OU on velocity, with world-box bouncing
 */

import { vec4, add4, scale4 } from './math4d.js';

export class Turkey {
  constructor(position = null) {
    // Position in R^4 - start near origin if not specified
    if (position) {
      this.position = position;
    } else {
      // Random position in a sphere around origin (32x larger range)
      const r = Math.random() * 9.6; // Within radius 9.6 of origin
      const direction = [
        gaussianRandom(),
        gaussianRandom(),
        gaussianRandom(),
        gaussianRandom()
      ];
      const len = Math.sqrt(direction.reduce((sum, x) => sum + x*x, 0));
      this.position = direction.map(x => (x / len) * r);
    }

    // Ornstein-Uhlenbeck on velocity: dV = -β V dt + σ dW ; dX = V dt
    this.velocity = vec4(0, 0, 0, 0);
    this.beta = 1.2;     // velocity mean-reversion rate (friction)
    this.sigmaV = 0.9;   // velocity noise scale
    this.maxSpeed = 1.5; // soft clamp to avoid runaway

    // Game state
    this.pardoned = false;

    // Visual state
    this.scale = 1.0;
    this.rotation = Math.random() * Math.PI * 2;
    this.hue = Math.random() * 360; // Random hue for color variation
  }

  /**
   * Update turkey (static position; no movement)
   * We freeze translation; pardoned turkeys still animate their medal pulse.
   * @param {number} dt - Time step
   */
  update(dt) {
    if (this.pardoned) {
      // Pardoned turkeys stop moving and celebrate
      this.rotation += dt * 2; // Spin slowly
      this.scale = 1.0 + Math.sin(Date.now() * 0.002) * 0.1; // Pulse
      return;
    }
    // No movement: keep velocity zero
    this.velocity = vec4(0, 0, 0, 0);
  }

  /**
   * Mark turkey as pardoned
   */
  pardon() {
    if (!this.pardoned) {
      this.pardoned = true;
      this.velocity = vec4(0, 0, 0, 0);
    }
  }

  /**
   * Check if this turkey is pardoned
   */
  isPardoned() {
    return this.pardoned;
  }

  /**
   * Get projected 2D position for scatterplot (i, j)
   */
  getProjection(dimI, dimJ) {
    return {
      x: this.position[dimI],
      y: this.position[dimJ]
    };
  }
}

// Gaussian random number (Box-Muller transform)
function gaussianRandom() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Create a flock of turkeys
 */
export function createTurkeyFlock(count = 10) {
  const turkeys = [];
  for (let i = 0; i < count; i++) {
    turkeys.push(new Turkey());
  }
  return turkeys;
}
