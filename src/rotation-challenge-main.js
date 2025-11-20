/**
 * Rotation Matching Challenge - Main Entry Point
 */

import './style.css';
import { RotationChallenge } from './rotation-challenge.js';

// Initialize challenge when DOM is ready
function init() {
  const canvas = document.getElementById('game-canvas');
  const newChallengeButton = document.getElementById('new-challenge-button');
  const halfDistanceButton = document.getElementById('half-distance-button');
  const dimensionSelect = document.getElementById('dimension-select');
  const displayModeSelect = document.getElementById('display-mode-select');
  const gridToggle = document.getElementById('grid-toggle');
  const subtitle = document.getElementById('subtitle');
  const scrollHint = document.getElementById('scroll-hint');

  // Create challenge instance
  let currentDimensions = parseInt(dimensionSelect.value) || 4;
  let challenge = new RotationChallenge(canvas, currentDimensions);

  // Update subtitle to reflect current dimension
  function updateSubtitle(dim) {
    const superscripts = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
    subtitle.textContent = `Curves in R${superscripts[dim] || dim} • Master SO(${dim}) • Find the Hidden Rotation`;
  }
  updateSubtitle(currentDimensions);

  // New challenge button
  newChallengeButton.addEventListener('click', () => {
    challenge.newChallenge();
  });

  // Half the distance button
  halfDistanceButton.addEventListener('click', () => {
    challenge.halfTheDistance();
  });

  // Dimension selector wiring
  dimensionSelect.addEventListener('change', () => {
    const newDimensions = parseInt(dimensionSelect.value);
    if (newDimensions !== currentDimensions) {
      // Stop the current challenge
      challenge.running = false;

      // Create a new challenge with the new dimensions
      currentDimensions = newDimensions;
      challenge = new RotationChallenge(canvas, currentDimensions);

      // Update subtitle
      updateSubtitle(currentDimensions);

      // Start the new challenge
      challenge.start();
    }
  });

  // Display mode selector wiring
  displayModeSelect.addEventListener('change', () => {
    challenge.setDisplayMode(displayModeSelect.value);
  });

  // Grid toggle wiring
  gridToggle.addEventListener('change', () => {
    challenge.setGridEnabled(gridToggle.checked);
  });

  // Hide scroll hint only when at least half of the canvas is visible
  const updateScrollHint = () => {
    if (!scrollHint || scrollHint.classList.contains('hidden')) return;
    const rect = canvas.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.height <= 0) return;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const ratio = visible / rect.height;
    if (ratio >= 0.5) {
      scrollHint.classList.add('hidden');
      window.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    }
  };
  window.addEventListener('scroll', updateScrollHint, { passive: true });
  window.addEventListener('resize', updateScrollHint);
  updateScrollHint();

  // Start challenge loop
  challenge.start();

  console.log('🔄 Rotation Matching Challenge initialized!');
  console.log('Find the hidden rotation in SO(n)!');

  // Display git hash in footer
  const gitHashEl = document.getElementById('git-hash');
  if (gitHashEl) {
    gitHashEl.textContent = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'unknown';
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
