/**
 * Game Logic and State Management
 */

import {
  vec4,
  vecN,
  add4,
  addN,
  scale4,
  scaleN,
  identity4x4,
  identityNxN,
  rotation4D,
  rotationND,
  matVecMult,
  matVecMultN,
  matMult,
  matMultN,
  distance4,
  distanceN,
  lerp,
  lerpMatrix,
  lerpMatrixN
} from './math4d.js';
import { createTurkeyFlock, Turkey } from './turkey.js';
import { ScatterplotMatrix } from './scatterplot.js';

export class Game {
  constructor(canvas, dimensions = 4) {
    this.dimensions = dimensions;

    // Player state
    this.player = {
      position: vecN(dimensions), // Start at origin
      orientation: identityNxN(dimensions), // Current orientation matrix
      forwardDir: (() => {
        const v = vecN(dimensions);
        v[0] = 1;
        return v;
      })() // Forward direction in local space
    };

    // Rotation animation
    this.targetOrientation = identityNxN(dimensions);
    this.startOrientation = identityNxN(dimensions);
    this.isRotating = false;
    this.rotationProgress = 0;
    this.rotationDuration = 0.25; // seconds for rotation (faster for continuous rotation)
    this.rotationAngle = Math.PI / 32; // Small rotation: ~5.6 degrees
    this.currentRotationDims = [0, 1]; // Which dimensions are rotating

    // Ship + movement controls
    this.shipType = 'aerilou';
    this.isMovingForward = false; // Is 'W' held?
    this.moveSpeed = 0.8; // Units per second (aerilou)

    // Momentum ship dynamics (Druuge)
    this.playerVelocity = vecN(dimensions);
    this.linearThrust = 1.4; // accel (units/s^2)
    this.linearDamp = 0.8;   // 1/s (less damping)
    this.maxSpeed = 2.0;
    // Angular velocity for all rotation planes
    this.planes = this.generateRotationPlanes(dimensions);
    this.angularVel = new Float32Array(this.planes.length);
    this.angularThrust = 2.5; // rad/s^2
    this.angularDamp = 1.1;   // 1/s (less damping)
    this.maxAngVel = 3.0;     // rad/s
    // Thrust puff timing
    this.puffs = [];
    this.linearPuffCooldown = 0;
    this.rotPuffCooldown = 0;

    // Game settings
    this.pardonRadius = 1.5; // Distance to pardon a turkey (3x easier)

    // Turkeys: only one active at a time
    this.turkeys = createTurkeyFlock(1);
    // Ensure the first turkey spawns within the box and not on top of player
    this.turkeys[0] = this.spawnTurkeyFarFromPlayer();
    this.pardonedTotal = 0; // running total across spawns

    // Rendering
    this.scatterplot = new ScatterplotMatrix(canvas, dimensions);
    // Rotation handled smoothly while mouse is held on a cell; no discrete step on click
    this.scatterplot.onPlotClick((dimI, dimJ) => {});
    this.scatterplot.onDiagonalClick((dim) => this.moveAlongDimension(dim));

    // UI elements
    this.pardonedCountEl = document.getElementById('pardoned-count');
    this.totalCountEl = document.getElementById('total-count');
    this.movementStatusEl = document.getElementById('movement-status');
    this.distanceEl = document.getElementById('distance-display');

    // Game loop
    this.lastTime = performance.now();
    this.running = true;

    // Update initial UI
    this.updateUI();
    this.updateMovementStatus();
    this.updateDistanceIndicator();

    // Continuous rotation parameters
    this.rotationSpeed = Math.PI / 2; // rad/sec while held (~90 deg/sec)
    this.isRotatingContinuous = false;
  }

  /**
   * Generate all rotation planes for N dimensions
   * Returns all pairs [i, j] where i < j
   */
  generateRotationPlanes(n) {
    const planes = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        planes.push([i, j]);
      }
    }
    return planes;
  }

  setShipType(type) {
    // Accept 'aerilou' or 'druuge' (momentum)
    if (type !== 'aerilou' && type !== 'druuge') return;
    this.shipType = type;
  }

  /**
   * Request a rotation in the (i, j) plane
   */
  requestRotation(dimI, dimJ) {
    if (this.isRotating) {
      return; // Already rotating
    }

    // Start rotation animation
    this.isRotating = true;
    this.rotationProgress = 0;
    this.currentRotationDims = [dimI, dimJ];
    this.startOrientation = this.player.orientation;

    // Create target orientation with small rotation in current local basis (post-multiply)
    const rotMat = rotationND(this.dimensions, dimI, dimJ, this.rotationAngle);
    this.targetOrientation = matMultN(this.player.orientation, rotMat);

    this.updateMovementStatus();
  }

  /**
   * Start/stop moving forward
   */
  setMovingForward(moving) {
    this.isMovingForward = moving;
    this.updateMovementStatus();
  }

  /**
   * Move along a specific dimension in player's reference frame
   * @param {number} dim - Dimension index (0 to dimensions-1)
   */
  moveAlongDimension(dim) {
    // Create a unit vector in the specified dimension (player's local frame)
    const localDir = vecN(this.dimensions);
    localDir[dim] = 1;

    // Transform to world space
    const worldDir = matVecMultN(this.player.orientation, localDir);

    // Move a fixed distance
    const distance = 0.5;
    const movement = scaleN(worldDir, distance);
    this.player.position = addN(this.player.position, movement);

    // Check for turkeys to pardon
    this.checkPardonRadius();
  }

  /**
   * Check if player is close enough to any turkeys
   */
  checkPardonRadius() {
    for (let i = 0; i < this.turkeys.length; i++) {
      const turkey = this.turkeys[i];
      const dist = distanceN(this.player.position, turkey.position);
      if (dist < this.pardonRadius) {
        // Increment running total and respawn a new turkey elsewhere
        this.pardonedTotal += 1;
        this.turkeys[i] = this.spawnTurkeyFarFromPlayer();
        this.updateUI();
        this.updateDistanceIndicator();
        break;
      }
    }
  }

  /**
   * Update game state
   */
  update(dt) {
    // Update the distance indicator every frame
    this.updateDistanceIndicator();
    // Handle rotation/motion controls per ship type
    const heldDims = this.scatterplot.checkContinuousRotation();
    const prevContinuous = this.isRotatingContinuous;
    if (this.shipType === 'aerilou') {
      if (heldDims) {
        const [i, j] = heldDims;
        const angle = this.rotationSpeed * dt;
        const rotStep = rotationND(this.dimensions, i, j, angle);
        // Apply rotation in the current local basis: post-multiply
        this.player.orientation = matMultN(this.player.orientation, rotStep);
        this.isRotatingContinuous = true;
      } else {
        this.isRotatingContinuous = false;
      }
    } else {
      // Druuge: add angular momentum while held; integrate separately
      if (heldDims) {
        const [i, j] = heldDims;
        const idx = this.getPlaneIndex(i, j);
        const sign = i < j ? 1 : -1;
        this.angularVel[idx] += sign * this.angularThrust * dt;
        // Clamp angular velocity
        this.angularVel[idx] = Math.max(-this.maxAngVel, Math.min(this.maxAngVel, this.angularVel[idx]));
        // Emit puffs at interval
        this.rotPuffCooldown -= dt;
        if (this.rotPuffCooldown <= 0) {
          this.addPuff({ type: 'angular', plane: [Math.min(i,j), Math.max(i,j)], dir: sign, ttl: 0.5 });
          this.rotPuffCooldown = 0.18;
        }
        this.isRotatingContinuous = true;
      } else {
        this.isRotatingContinuous = false;
      }
    }
    if (prevContinuous !== this.isRotatingContinuous) this.updateMovementStatus();

    // Update turkeys
    this.turkeys.forEach(turkey => turkey.update(dt));

    // Enforce world bounds (hypercube) on turkeys
    const r = this.scatterplot.gridRange;
    this.turkeys.forEach(t => {
      for (let i = 0; i < this.dimensions; i++) {
        if (t.position[i] < -r) {
          t.position[i] = -r;
          if (t.velocity && t.velocity[i] < 0) t.velocity[i] *= -0.3; // damped bounce
        } else if (t.position[i] > r) {
          t.position[i] = r;
          if (t.velocity && t.velocity[i] > 0) t.velocity[i] *= -0.3; // damped bounce
        }
      }
    });

    // Update rotation animation with smooth interpolation (aerilou only)
    if (this.shipType === 'aerilou' && this.isRotating && !this.isRotatingContinuous) {
      this.rotationProgress += dt / this.rotationDuration;

      if (this.rotationProgress >= 1.0) {
        // Rotation complete
        this.player.orientation = this.targetOrientation;
        this.isRotating = false;
        this.rotationProgress = 0;
        this.updateMovementStatus();

        // Check if we should continue rotating (mouse held)
        // No chaining here; continuous rotation handled separately above
      } else {
        // Smooth interpolation using ease-in-out
        const t = this.easeInOutCubic(this.rotationProgress);
        this.player.orientation = lerpMatrixN(this.startOrientation, this.targetOrientation, t);
      }
    }

    if (this.shipType === 'aerilou') {
      // Direct forward movement
      if (this.isMovingForward) {
        const worldDir = matVecMultN(this.player.orientation, this.player.forwardDir);
        const movement = scaleN(worldDir, this.moveSpeed * dt);
        this.player.position = addN(this.player.position, movement);
        this.checkPardonRadius();
      }
    } else {
      // Druuge linear thrust + damping
      if (this.isMovingForward) {
        const worldDir = matVecMultN(this.player.orientation, this.player.forwardDir);
        // v += a*dt
        this.playerVelocity = addN(this.playerVelocity, scaleN(worldDir, this.linearThrust * dt));
        // Emit linear puffs at interval
        this.linearPuffCooldown -= dt;
        if (this.linearPuffCooldown <= 0) {
          this.addPuff({ type: 'linear', ttl: 0.4 });
          this.linearPuffCooldown = 0.12;
        }
      }
      // Damping
      const linFactor = Math.exp(-this.linearDamp * dt);
      this.playerVelocity = scaleN(this.playerVelocity, linFactor);
      // Clamp speed
      const v2 = this.playerVelocity.reduce((sum, v) => sum + v * v, 0);
      if (v2 > this.maxSpeed*this.maxSpeed) {
        const s = this.maxSpeed / Math.sqrt(v2);
        this.playerVelocity = scaleN(this.playerVelocity, s);
      }
      // Integrate position
      this.player.position = addN(this.player.position, scaleN(this.playerVelocity, dt));
      this.checkPardonRadius();
      // Integrate angular velocity into orientation
      const angFactor = Math.exp(-this.angularDamp * dt);
      for (let k = 0; k < this.angularVel.length; k++) this.angularVel[k] *= angFactor;
      for (let k = 0; k < this.planes.length; k++) {
        const [i, j] = this.planes[k];
        const angle = this.angularVel[k] * dt;
        if (angle !== 0) {
          const rot = rotationND(this.dimensions, i, j, angle);
          this.player.orientation = matMultN(this.player.orientation, rot);
        }
      }
    }

    // Enforce world bounds on player
    const pr = this.scatterplot.gridRange;
    for (let i = 0; i < this.dimensions; i++) {
      if (this.player.position[i] < -pr) this.player.position[i] = -pr;
      if (this.player.position[i] >  pr) this.player.position[i] =  pr;
    }
    // Decay and prune puffs
    this.puffs = this.puffs.filter(p => {
      p.ttl -= dt;
      return p.ttl > 0;
    });
  }

  /**
   * Ease-in-out cubic for smooth animation
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Render the game
   */
  render() {
    this.scatterplot.render(this.player, this.turkeys, {
      shipType: this.shipType,
      puffs: this.puffs,
      forwardDir: this.player.forwardDir,
    });
  }

  /**
   * Main game loop
   */
  gameLoop(currentTime) {
    if (!this.running) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  /**
   * Start the game loop
   */
  start() {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  /**
   * Get count of pardoned turkeys
   */
  getAllPardonedCount() {
    return this.pardonedTotal;
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.pardonedCountEl.textContent = this.getAllPardonedCount();
    if (this.totalCountEl) this.totalCountEl.textContent = '∞';
  }

  /**
   * Update orientation display
   */
  updateMovementStatus() {
    let status = 'Idle';
    const rotating = this.isRotating || this.isRotatingContinuous;
    if (this.isMovingForward && rotating) {
      status = 'Forward + Rotating';
    } else if (this.isMovingForward) {
      status = 'Forward';
    } else if (rotating) {
      status = 'Rotating';
    }
    if (this.movementStatusEl) this.movementStatusEl.textContent = status;
  }

  /**
   * Handle win condition
   */
  onWin() {
    // No win condition when turkeys respawn indefinitely
  }

  // Spawn a turkey within the world box but not too close to the player
  spawnTurkeyFarFromPlayer() {
    const Rbase = this.scatterplot ? this.scatterplot.gridRange : 4.0;
    const R = Rbase * 0.8; // keep comfortably inside
    let pos;
    let attempts = 0;
    do {
      pos = [];
      for (let i = 0; i < this.dimensions; i++) {
        pos.push((Math.random() * 2 - 1) * R);
      }
      attempts++;
    } while (distanceN(this.player.position, pos) < this.pardonRadius * 8 && attempts < 50);
    return new Turkey(pos);
  }

  // Utility: index into angular velocities for plane (i,j)
  getPlaneIndex(i, j) {
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    for (let idx = 0; idx < this.planes.length; idx++) {
      const [pi, pj] = this.planes[idx];
      if (pi === a && pj === b) return idx;
    }
    return 0;
  }

  addPuff(puff) {
    // puff: {type: 'linear'|'angular', plane?: [i,j], ttl}
    puff.ttl = puff.ttl ?? 0.4;
    puff.life = puff.ttl;
    this.puffs.push(puff);
  }

  // Update distance-to-target indicator
  updateDistanceIndicator() {
    if (!this.distanceEl) return;
    const target = this.turkeys && this.turkeys[0];
    if (!target) {
      this.distanceEl.textContent = '—';
      return;
    }
    const d = distanceN(this.player.position, target.position);
    // Format with 2 decimals
    this.distanceEl.textContent = d.toFixed(2);
  }
}
