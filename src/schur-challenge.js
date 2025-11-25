/**
 * Schur Decomposition Challenge
 * Goal: Find the block diagonalization of a skew-symmetric matrix
 */

import {
  identityNxN,
  rotationND,
  matMultN,
  transposeN,
  matVecMultN,
  randomSkewSymmetric,
  matrixExponentialSync,
  getInvariantBlocks,
  offBlockDiagonalNorm,
  similarityTransform
} from './math4d.js';
import { ScatterplotMatrix } from './scatterplot.js';
import {
  generateSpherePath,
  sampleRandomRotation,
  computeArcLengths,
  resamplePathUniformly
} from './sphere-path.js';
import * as math from 'mathjs';
import { arrayToMathMatrix, mathMatrixToArray } from './geodesic.js';

export class SchurChallenge {
  constructor(canvas, dimensions = 4) {
    this.dimensions = dimensions;
    this.canvas = canvas;

    // Player's current orientation (what they control)
    this.playerOrientation = identityNxN(dimensions);

    // The skew-symmetric matrix defining the rotation
    this.skewMatrix = null;

    // The target Schur form (for reference, not shown to user initially)
    this.targetSchurBasis = null;

    // Original points to animate
    this.originalPoints = [];

    // Time parameter for animation
    this.animationTime = 0;
    this.animationSpeed = 0.3; // Multiplier for t in e^(tK)

    // Display settings
    this.displayMode = 'turkey'; // 'vanilla', 'rainbow', 'numbered', 'turkey'
    this.gridEnabled = false;
    this.mobileViewEnabled = false;
    this.mobileOverlayEnabled = false;

    // Rotation state
    this.rotationSpeed = Math.PI / 2; // rad/sec
    this.rotationPlanes = this.generateRotationPlanes(dimensions);

    // Scoring - off-block-diagonal norm
    this.currentScore = Infinity;
    this.bestScore = Infinity;
    this.winThreshold = 0.2; // Threshold for winning
    this.hasWon = false;

    // Expected block structure
    this.expectedBlocks = getInvariantBlocks(dimensions);

    // Rendering
    this.scatterplot = new ScatterplotMatrix(canvas, dimensions);

    // UI elements
    this.scoreEl = document.getElementById('alignment-score');
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
   * Generate a new challenge with random skew-symmetric matrix
   */
  newChallenge() {
    // Generate a random skew-symmetric matrix
    this.skewMatrix = randomSkewSymmetric(this.dimensions);

    // Generate a smooth curve to animate
    // Use the same path generation as rotation challenge
    const rawPath = generateSpherePath(this.dimensions, 100, 3);

    // Resample to have evenly-spaced points (eliminates jittering)
    this.originalPoints = resamplePathUniformly(rawPath, 100);

    // Reset player orientation
    this.playerOrientation = identityNxN(this.dimensions);

    // Reset animation time
    this.animationTime = 0;

    // Reset scoring
    this.currentScore = Infinity;
    this.bestScore = Infinity;
    this.hasWon = false;

    this.updateUI();
  }

  /**
   * Update game state
   */
  update(dt) {
    // Update animation time
    this.animationTime += dt * this.animationSpeed;

    // Check for continuous rotation
    const heldDims = this.scatterplot.checkContinuousRotation();

    if (heldDims) {
      const [i, j] = heldDims;
      // Get rotation direction from scatterplot (1 = CW, -1 = CCW)
      const direction = this.scatterplot.rotationDirection || 1;
      // Negate direction to match visual convention
      const angle = this.rotationSpeed * dt * (-direction);
      const rotStep = rotationND(this.dimensions, i, j, angle);
      // Apply rotation: post-multiply
      this.playerOrientation = matMultN(this.playerOrientation, rotStep);
    }

    // Compute current score (off-block-diagonal norm)
    this.updateScore();

    // Check win condition
    if (!this.hasWon && this.currentScore <= this.winThreshold) {
      this.hasWon = true;
      this.onWin();
    }

    this.updateUI();
  }

  /**
   * Compute off-block-diagonal norm of Q^T K Q
   */
  updateScore() {
    // Compute Q^T @ K @ Q
    const transformed = similarityTransform(this.playerOrientation, this.skewMatrix);

    // Compute off-block-diagonal norm
    this.currentScore = offBlockDiagonalNorm(transformed, this.expectedBlocks);

    // Update best score
    if (this.currentScore < this.bestScore) {
      this.bestScore = this.currentScore;
    }
  }

  /**
   * Render the challenge
   */
  render() {
    // Compute exp(t * K) for current animation time
    const expMat = matrixExponentialSync(
      this.skewMatrix,
      this.animationTime,
      math,
      arrayToMathMatrix,
      mathMatrixToArray
    );

    // Transform the entire curve by exp(t*K) (in world coordinates)
    // The scatterplot will apply Q^T transformation via the player orientation
    const rotatedPath = this.originalPoints.map(point => {
      return matVecMultN(expMat, point);
    });

    // Create a fake "player" at origin with Q as orientation
    // The scatterplot renders in player's frame, so it will show Q^T @ rotatedPath
    const player = {
      position: new Array(this.dimensions).fill(0),
      orientation: this.playerOrientation
    };

    // Render as a rainbow path
    const pathsToRender = [
      {
        points: rotatedPath,
        color: 'rainbow',
        label: 'curve',
        fixed: false
      }
    ];

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
    // Update score display
    if (this.scoreEl) {
      this.scoreEl.textContent = this.currentScore === Infinity
        ? '—'
        : this.currentScore.toFixed(3);
    }

    if (this.bestScoreEl) {
      this.bestScoreEl.textContent = this.bestScore === Infinity
        ? '—'
        : this.bestScore.toFixed(3);
    }
  }

  /**
   * Handle win condition
   */
  onWin() {
    console.log('🎉 Schur decomposition found!');
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
   * Set mobile view enabled state
   */
  setMobileViewEnabled(enabled) {
    this.mobileViewEnabled = enabled;
    this.scatterplot.setMobileViewEnabled(enabled);
  }

  /**
   * Set mobile overlay enabled state
   */
  setMobileOverlayEnabled(enabled) {
    this.mobileOverlayEnabled = enabled;
    this.scatterplot.setMobileOverlayEnabled(enabled);
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
