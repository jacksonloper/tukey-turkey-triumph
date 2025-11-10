/**
 * Rotation Matching Challenge
 * Goal: Align two curves by finding the correct rotation
 */

import {
  identityNxN,
  rotationND,
  matMultN,
  transposeN,
  rotationDistanceSO,
  interpRotationSO
} from './math4d.js';
import { ScatterplotMatrix } from './scatterplot.js';
import {
  generateSpherePath,
  generateSimplex,
  generateCircularOrientation,
  sampleRandomRotation,
  rotatePath
} from './sphere-path.js';

export class RotationChallenge {
  constructor(canvas, dimensions = 4, simplexMode = false) {
    this.dimensions = dimensions;
    this.canvas = canvas;
    this.simplexMode = simplexMode;

    // Player's current orientation (what they control)
    this.playerOrientation = identityNxN(dimensions);

    // The secret rotation to find
    this.targetRotation = null;

    // The original path and rotated target path
    this.originalPath = null;
    this.targetPath = null;

    // Vertex labels (for simplex mode)
    this.vertexLabels = null;

    // Rotation state
    this.rotationSpeed = Math.PI / 2; // rad/sec
    this.rotationPlanes = this.generateRotationPlanes(dimensions);

    // Scoring - rotation distance on SO(n)
    this.currentDistance = Infinity;
    this.bestDistance = Infinity;
    this.winThreshold = 0.1; // Distance threshold for winning (close to 0)
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
    if (this.simplexMode) {
      // Generate base simplex with labeled vertices
      const baseSimplex = generateSimplex(this.dimensions, 3);

      // Create labels for vertices (0, 1, 2, ...)
      this.vertexLabels = [];
      for (let i = 0; i < baseSimplex.length; i++) {
        this.vertexLabels.push(String(i));
      }

      // Apply circular orientation to base simplex to get orange (original) path
      // This makes the orange simplex appear as a nice circle in (D1, D2)
      const circularOrientation = generateCircularOrientation(this.dimensions, baseSimplex);
      this.originalPath = rotatePath(baseSimplex, circularOrientation);

      // Sample a random rotation for the target (cyan) path
      this.targetRotation = sampleRandomRotation(this.dimensions);
      this.targetPath = rotatePath(this.originalPath, this.targetRotation);
    } else {
      // Generate a smooth random path on the sphere
      this.originalPath = generateSpherePath(this.dimensions, 100, 3);
      this.vertexLabels = null;

      // Sample a random rotation
      this.targetRotation = sampleRandomRotation(this.dimensions);
      this.targetPath = rotatePath(this.originalPath, this.targetRotation);
    }

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
        // Use rotation interpolation to preserve orthonormality
        this.playerOrientation = interpRotationSO(
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

    // Compute current rotation distance
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
   * Compute rotation distance between player orientation and target rotation
   */
  updateDistance() {
    // Compute distance: ||R^T Q - I||_F
    // where R = targetRotation, Q = playerOrientation
    this.currentDistance = rotationDistanceSO(this.targetRotation, this.playerOrientation);

    // Update best score (minimum distance)
    if (this.currentDistance < this.bestDistance) {
      this.bestDistance = this.currentDistance;
    }
  }

  /**
   * Toggle simplex mode on/off
   */
  setSimplexMode(enabled) {
    if (this.simplexMode !== enabled) {
      this.simplexMode = enabled;
      this.newChallenge();
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
    const pathOptions = {
      showPlayer: false, // Don't show the central dot
      paths: [
        {
          points: this.originalPath,
          color: 'rgba(255, 140, 0, 0.8)',
          label: 'original',
          fixed: true,
          vertexLabels: this.simplexMode ? this.vertexLabels : null
        },
        {
          points: this.targetPath,
          color: 'rgba(0, 255, 255, 0.8)',
          label: 'target',
          fixed: false,
          vertexLabels: this.simplexMode ? this.vertexLabels : null
        }
      ]
    };

    this.scatterplot.render(player, [], pathOptions);
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
  }

  /**
   * Auto-rotate partway toward the target rotation
   */
  halfTheDistance() {
    if (this.isAnimatingHalfway) return; // Already animating

    // Interpolate halfway toward target using linear interp + Gram-Schmidt
    const targetOrientation = interpRotationSO(
      this.playerOrientation,
      this.targetRotation,
      0.5
    );

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
