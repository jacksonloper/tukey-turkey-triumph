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
  interpRotationSO,
  geodesicInterpArray,
  geodesicDistanceArray
} from './math4d.js';
import { ScatterplotMatrix } from './scatterplot.js';
import {
  generateSpherePath,
  sampleRandomRotation,
  rotatePath,
  computeArcLengths,
  resamplePathUniformly
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
    
    // Arc lengths for squirrel animation (constant speed along path)
    this.arcLengths = null;
    this.totalArcLength = 0;

    // Display settings
    this.displayMode = 'vanilla'; // 'vanilla', 'rainbow', 'numbered', 'squirrel'
    this.gridEnabled = false;

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

    // Squirrel mode animation state
    this.squirrelProgress = 0; // 0 to 1, in terms of arc length
    this.squirrelDuration = 6.0; // seconds to traverse whole path

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
    // Generate a smooth random path on the sphere
    const rawPath = generateSpherePath(this.dimensions, 100, 3);
    
    // Resample to have evenly-spaced points (eliminates jittering)
    this.originalPath = resamplePathUniformly(rawPath, 100);

    // Compute arc lengths for constant-speed squirrel animation
    this.arcLengths = computeArcLengths(this.originalPath);
    this.totalArcLength = this.arcLengths[this.arcLengths.length - 1];

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
    // Update squirrel animation progress (arc-length based, constant speed)
    if (this.displayMode === 'squirrel') {
      this.squirrelProgress += dt / this.squirrelDuration;
      this.squirrelProgress = this.squirrelProgress % 1.0; // Keep in [0,1)
    }

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
   * Uses geodesic distance: ||log(R^T Q)||_F
   */
  updateDistance() {
    // Compute geodesic distance: ||log(R^T Q)||_F
    // where R = targetRotation, Q = playerOrientation
    this.currentDistance = geodesicDistanceArray(this.targetRotation, this.playerOrientation);

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

    // Prepare path rendering based on display mode
    let pathsToRender = [];
    
    if (this.displayMode === 'vanilla') {
      // Original solid color mode
      pathsToRender = [
        { points: this.originalPath, color: 'rgba(255, 140, 0, 0.8)', label: 'original', fixed: true },
        { points: this.targetPath, color: 'rgba(0, 255, 255, 0.8)', label: 'target', fixed: false }
      ];
    } else if (this.displayMode === 'rainbow') {
      // Rainbow mode - both paths are rainbows with matched colors
      pathsToRender = [
        { points: this.originalPath, color: 'rainbow', label: 'original', fixed: true },
        { points: this.targetPath, color: 'rainbow', label: 'target', fixed: false }
      ];
    } else if (this.displayMode === 'numbered') {
      // Numbered mode - show 6 numbered dots along each path
      pathsToRender = [
        { points: this.originalPath, color: 'rgba(255, 140, 0, 0.8)', label: 'original', fixed: true, numbered: true, numDots: 6 },
        { points: this.targetPath, color: 'rgba(0, 255, 255, 0.8)', label: 'target', fixed: false, numbered: true, numDots: 6 }
      ];
    } else if (this.displayMode === 'squirrel') {
      // Squirrel mode - show animated markers moving along paths
      // Pass arc length data for constant-speed animation
      pathsToRender = [
        { 
          points: this.originalPath, 
          color: 'rgba(255, 140, 0, 0.8)', 
          label: 'original', 
          fixed: true, 
          squirrel: true, 
          progress: this.squirrelProgress,
          arcLengths: this.arcLengths 
        },
        { 
          points: this.targetPath, 
          color: 'rgba(0, 255, 255, 0.8)', 
          label: 'target', 
          fixed: false, 
          squirrel: true, 
          progress: this.squirrelProgress,
          arcLengths: this.arcLengths 
        }
      ];
    }

    // Render both paths
    this.scatterplot.render(player, [], {
      showPlayer: false,
      showGrid: this.gridEnabled,
      paths: pathsToRender
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
  }

  /**
   * Auto-rotate partway toward the target rotation
   * Uses geodesic interpolation via matrix logarithm and exponential
   */
  halfTheDistance() {
    if (this.isAnimatingHalfway) return; // Already animating

    // Interpolate halfway toward target using geodesic interpolation
    // This uses logm and expm for proper geodesic path on SO(n)
    const targetOrientation = geodesicInterpArray(
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
   * Set display mode
   */
  setDisplayMode(mode) {
    this.displayMode = mode;
  }

  /**
   * Set grid enabled state
   */
  setGridEnabled(enabled) {
    this.gridEnabled = enabled;
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
