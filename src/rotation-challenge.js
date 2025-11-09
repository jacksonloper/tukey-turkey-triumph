/**
 * Rotation Matching Challenge
 * Goal: Align two curves by finding the correct rotation
 */

import {
  identityNxN,
  rotationND,
  matMultN,
  transposeN
} from './math4d.js';
import { ScatterplotMatrix } from './scatterplot.js';
import {
  generateSpherePath,
  sampleRandomRotation,
  rotatePath,
  computeAlignment
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

    // Scoring
    this.currentAlignment = 0;
    this.bestAlignment = 0;
    this.winThreshold = 0.98; // Need 98% alignment to win
    this.hasWon = false;

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
    this.currentAlignment = 0;
    this.hasWon = false;

    this.updateUI();
  }

  /**
   * Update game state
   */
  update(dt) {
    // Check for continuous rotation
    const heldDims = this.scatterplot.checkContinuousRotation();

    if (heldDims) {
      const [i, j] = heldDims;
      const angle = this.rotationSpeed * dt;
      const rotStep = rotationND(this.dimensions, i, j, angle);
      // Apply rotation in current local basis: post-multiply
      this.playerOrientation = matMultN(this.playerOrientation, rotStep);
    }

    // Compute current alignment
    this.updateAlignment();

    // Check win condition
    if (!this.hasWon && this.currentAlignment >= this.winThreshold) {
      this.hasWon = true;
      this.onWin();
    }

    this.updateUI();
  }

  /**
   * Compute alignment between player's view and target
   */
  updateAlignment() {
    // Transform target path by player's orientation to see how close it is to original
    const playerRotatedTarget = rotatePath(this.targetPath, transposeN(this.playerOrientation));

    // Compute alignment score
    this.currentAlignment = computeAlignment(this.originalPath, playerRotatedTarget);

    // Update best score
    if (this.currentAlignment > this.bestAlignment) {
      this.bestAlignment = this.currentAlignment;
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
    // Original path in orange, target path in cyan
    this.scatterplot.render(player, [], {
      paths: [
        { points: this.originalPath, color: 'rgba(255, 140, 0, 0.8)', label: 'original' },
        { points: this.targetPath, color: 'rgba(0, 255, 255, 0.8)', label: 'target' }
      ]
    });
  }

  /**
   * Update UI elements
   */
  updateUI() {
    if (this.alignmentScoreEl) {
      this.alignmentScoreEl.textContent = `${(this.currentAlignment * 100).toFixed(1)}%`;
    }

    if (this.bestScoreEl) {
      this.bestScoreEl.textContent = `${(this.bestAlignment * 100).toFixed(1)}%`;
    }

    if (this.challengeStatusEl) {
      if (this.hasWon) {
        this.challengeStatusEl.textContent = '🎉 Perfect Alignment!';
        this.challengeStatusEl.style.color = '#00ff00';
      } else if (this.currentAlignment >= 0.90) {
        this.challengeStatusEl.textContent = 'Very Close!';
        this.challengeStatusEl.style.color = '#ffff00';
      } else if (this.currentAlignment >= 0.70) {
        this.challengeStatusEl.textContent = 'Getting Warmer...';
        this.challengeStatusEl.style.color = '#ff9900';
      } else {
        this.challengeStatusEl.textContent = 'Rotating...';
        this.challengeStatusEl.style.color = '#ffffff';
      }
    }
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
