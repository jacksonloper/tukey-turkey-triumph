/**
 * Rotation Matching Challenge
 * Goal: Align two curves by finding the correct rotation
 */

import {
  identityNxN,
  rotationND,
  matMultN,
  transposeN,
  geodesicDistanceSO,
  matrixLogN,
  matrixExpN,
  matScaleN,
  lerpMatrixN
} from './math4d.js';
import { ScatterplotMatrix } from './scatterplot.js';
import {
  generateSpherePath,
  sampleRandomRotation,
  rotatePath
} from './sphere-path.js';

export class RotationChallenge {
  constructor(canvas, dimensions = 4) {
    this.dimensions = dimensions;
    this.canvas = canvas;

    // Player's current orientation (what they control)
    this.playerOrientation = identityNxN(dimensions);

    // The secret rotation to find
    this.targetRotation = null;

    // The original path and rotated target path
    this.originalPath = null;
    this.targetPath = null;

    // Rotation state
    this.rotationSpeed = Math.PI / 2; // rad/sec
    this.rotationPlanes = this.generateRotationPlanes(dimensions);

    // Scoring - geodesic distance on SO(n)
    this.currentDistance = Infinity;
    this.bestDistance = Infinity;
    this.winThreshold = 0.1; // Geodesic distance threshold for winning (close to 0)
    this.hasWon = false;

    // Halfway animation state
    this.isAnimatingHalfway = false;
    this.halfwayProgress = 0;
    this.halfwayDuration = 0.5; // seconds
    this.halfwayStartOrientation = null;
    this.halfwayTargetOrientation = null;

    // Rendering
    this.scatterplot = new ScatterplotMatrix(canvas, dimensions);

    // UI elements
    this.alignmentScoreEl = document.getElementById('alignment-score');
    this.challengeStatusEl = document.getElementById('challenge-status');
    this.bestScoreEl = document.getElementById('best-score');

    // Game loop
    this.lastTime = performance.now();
    this.running = true;

    // Generate initial challenge
    this.newChallenge();

    // Update initial UI
    this.updateUI();
  }

  /**
   * Generate all rotation planes for N dimensions
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

  /**
   * Generate a new challenge with random rotation
   */
  newChallenge() {
    // Generate a smooth random path on the sphere
    this.originalPath = generateSpherePath(this.dimensions, 100, 3);

    // Sample a random rotation
    this.targetRotation = sampleRandomRotation(this.dimensions);

    // Apply rotation to create target path
    this.targetPath = rotatePath(this.originalPath, this.targetRotation);

    // Reset player orientation
    this.playerOrientation = identityNxN(this.dimensions);

    // Reset scoring
    this.currentDistance = Infinity;
    this.bestDistance = Infinity;
    this.hasWon = false;

    this.updateUI();
  }

  /**
   * Update game state
   */
  update(dt) {
    // Handle halfway animation (takes precedence over manual rotation)
    if (this.isAnimatingHalfway) {
      this.halfwayProgress += dt / this.halfwayDuration;

      if (this.halfwayProgress >= 1.0) {
        // Animation complete
        this.playerOrientation = this.halfwayTargetOrientation;
        this.isAnimatingHalfway = false;
        this.halfwayProgress = 0;
      } else {
        // Smooth interpolation using ease-in-out
        const t = this.easeInOutCubic(this.halfwayProgress);
        this.playerOrientation = lerpMatrixN(
          this.halfwayStartOrientation,
          this.halfwayTargetOrientation,
          t
        );
      }
    } else {
      // Check for continuous rotation (only when not animating)
      const heldDims = this.scatterplot.checkContinuousRotation();

      if (heldDims) {
        const [i, j] = heldDims;
        const angle = this.rotationSpeed * dt;
        const rotStep = rotationND(this.dimensions, i, j, angle);
        // Apply rotation in current local basis: post-multiply
        this.playerOrientation = matMultN(this.playerOrientation, rotStep);
      }
    }

    // Compute current geodesic distance
    this.updateDistance();

    // Check win condition (distance below threshold)
    if (!this.hasWon && this.currentDistance <= this.winThreshold) {
      this.hasWon = true;
      this.onWin();
    }

    this.updateUI();
  }

  /**
   * Ease-in-out cubic for smooth animation
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Compute geodesic distance on SO(n) between player orientation and target rotation
   */
  updateDistance() {
    // Compute geodesic distance: ||log(R^T Q)||_F
    // where R = targetRotation, Q = playerOrientation
    this.currentDistance = geodesicDistanceSO(this.targetRotation, this.playerOrientation);

    // Update best score (minimum distance)
    if (this.currentDistance < this.bestDistance) {
      this.bestDistance = this.currentDistance;
    }
  }

  /**
   * Render the challenge
   */
  render() {
    // Create a fake "player" at origin (we don't show a player dot in this mode)
    const player = {
      position: new Array(this.dimensions).fill(0),
      orientation: this.playerOrientation
    };

    // Render both paths
    // Original path (orange) stays fixed in world space
    // Target path (cyan) rotates with player orientation
    this.scatterplot.render(player, [], {
      showPlayer: false, // Don't show the central dot
      paths: [
        { points: this.originalPath, color: 'rgba(255, 140, 0, 0.8)', label: 'original', fixed: true },
        { points: this.targetPath, color: 'rgba(0, 255, 255, 0.8)', label: 'target', fixed: false }
      ]
    });
  }

  /**
   * Update UI elements
   */
  updateUI() {
    if (this.alignmentScoreEl) {
      this.alignmentScoreEl.textContent = this.currentDistance === Infinity
        ? '—'
        : this.currentDistance.toFixed(3);
    }

    if (this.bestScoreEl) {
      this.bestScoreEl.textContent = this.bestDistance === Infinity
        ? '—'
        : this.bestDistance.toFixed(3);
    }

    if (this.challengeStatusEl) {
      if (this.hasWon) {
        this.challengeStatusEl.textContent = '🎉 Perfect Alignment!';
        this.challengeStatusEl.style.color = '#00ff00';
      } else if (this.currentDistance <= 0.2) {
        this.challengeStatusEl.textContent = 'Very Close!';
        this.challengeStatusEl.style.color = '#ffff00';
      } else if (this.currentDistance <= 0.5) {
        this.challengeStatusEl.textContent = 'Getting Warmer...';
        this.challengeStatusEl.style.color = '#ff9900';
      } else {
        this.challengeStatusEl.textContent = 'Rotating...';
        this.challengeStatusEl.style.color = '#ffffff';
      }
    }
  }

  /**
   * Move halfway toward the target rotation (Zeno's paradox style)
   */
  halfTheDistance() {
    if (this.isAnimatingHalfway) return; // Already animating

    // Compute relative rotation: Q^T R (what we need to apply to Q to get R)
    const QT = transposeN(this.playerOrientation);
    const relativeRotation = matMultN(QT, this.targetRotation);

    // Take logarithm to get Lie algebra element
    const logRel = matrixLogN(relativeRotation);

    // Scale by 0.5 to get halfway
    const halfLogRel = matScaleN(logRel, 0.5);

    // Exponential back to SO(n)
    const halfRotation = matrixExpN(halfLogRel);

    // Apply to current orientation: Q_new = Q * exp(0.5 * log(Q^T R))
    const targetOrientation = matMultN(this.playerOrientation, halfRotation);

    // Start animation
    this.isAnimatingHalfway = true;
    this.halfwayProgress = 0;
    this.halfwayStartOrientation = this.playerOrientation;
    this.halfwayTargetOrientation = targetOrientation;
  }

  /**
   * Handle win condition
   */
  onWin() {
    console.log('🎉 Challenge completed!');
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
}
