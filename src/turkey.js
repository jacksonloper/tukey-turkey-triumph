/**
 * Turkey AI with Ornstein-Uhlenbeck Velocity Process
 * Smooth correlated motion in R^N using OU on velocity, with world-box bouncing
 */

import { vec4, vecN, add4, scale4 } from './math4d.js';

export class Turkey {
  constructor(position = null) {
    // Position in R^N - start near origin if not specified
    if (position) {
      this.position = position;
    } else {
      // Default to 4D if position not provided
      const dims = 4;
      const r = Math.random() * 9.6; // Within radius 9.6 of origin
      const direction = Array.from({ length: dims }, () => gaussianRandom());
      const len = Math.sqrt(direction.reduce((sum, x) => sum + x*x, 0));
      this.position = direction.map(x => (x / len) * r);
    }

    // Ornstein-Uhlenbeck on velocity: dV = -β V dt + σ dW ; dX = V dt
    this.velocity = new Array(this.position.length).fill(0);
    this.beta = 1.2;     // velocity mean-reversion rate (friction)
    this.sigmaV = 0.9;   // velocity noise scale
    this.maxSpeed = 1.5; // soft clamp to avoid runaway

    // Game state
    this.pardoned = false;

    // Visual state
    this.scale = 1.0;
    this.rotation = Math.random() * Math.PI * 2;
    this.hue = Math.random() * 360; // Random hue for color variation

    // Part offsets in N-dimensional space (relative to body position)
    // These create a "turkey shape" that gets projected into each scatterplot
    // Use rotation to orient the turkey in the first 2 dimensions
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    // Head offset: ~6 units in rotated direction (matching sprite offset)
    this.headOffset = new Array(this.position.length).fill(0);
    this.headOffset[0] = cos * 0.06;  // Scale down from pixels to world units
    this.headOffset[1] = sin * 0.06;

    // Nose offset: ~4 units in rotated direction (between body and head)
    this.noseOffset = new Array(this.position.length).fill(0);
    this.noseOffset[0] = cos * 0.04;
    this.noseOffset[1] = sin * 0.04;
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
    this.velocity = new Array(this.position.length).fill(0);
  }

  /**
   * Mark turkey as pardoned
   */
  pardon() {
    if (!this.pardoned) {
      this.pardoned = true;
      this.velocity = new Array(this.position.length).fill(0);
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
