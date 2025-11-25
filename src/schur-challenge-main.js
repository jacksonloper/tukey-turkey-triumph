/**
 * Schur Decomposition Challenge - Main Entry Point
 */

import './style.css';
import { SchurChallenge } from './schur-challenge.js';
import { ensureWasmInitialized } from './geodesic.js';

// Initialize challenge when DOM is ready
async function init() {
  // Wait for WASM to initialize before starting the game
  await ensureWasmInitialized();
  const canvas = document.getElementById('game-canvas');
  const newChallengeButton = document.getElementById('new-challenge-button');
  const dimensionSelect = document.getElementById('dimension-select');
  const gridToggle = document.getElementById('grid-toggle');
  const mobileViewToggle = document.getElementById('mobile-view-toggle');
  const mobileOverlayToggle = document.getElementById('mobile-overlay-toggle');
  const subtitle = document.getElementById('subtitle');
  const scrollHint = document.getElementById('scroll-hint');

  // Create challenge instance
  let currentDimensions = parseInt(dimensionSelect.value) || 4;
  let challenge = new SchurChallenge(canvas, currentDimensions);

  // Initialize with current UI state
  if (gridToggle) challenge.setGridEnabled(gridToggle.checked);
  if (mobileViewToggle) challenge.setMobileViewEnabled(mobileViewToggle.checked);
  if (mobileOverlayToggle) challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);

  // Update subtitle to reflect current dimension
  function updateSubtitle(dim) {
    const superscripts = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
    const blockDesc = {
      2: '1 rotation plane',
      3: '2D + 1D blocks',
      4: '2D + 2D blocks',
      5: '2D + 2D + 1D blocks'
    };
    subtitle.textContent = `Curves in R${superscripts[dim] || dim} • Find ${blockDesc[dim] || 'block structure'} • Master Schur Decomposition`;
  }
  updateSubtitle(currentDimensions);

  // New challenge button
  newChallengeButton.addEventListener('click', () => {
    challenge.newChallenge();
  });

  // Dimension selector wiring
  dimensionSelect.addEventListener('change', () => {
    const newDimensions = parseInt(dimensionSelect.value);
    if (newDimensions !== currentDimensions) {
      // Stop the current challenge
      challenge.running = false;

      // Create a new challenge with the new dimensions
      currentDimensions = newDimensions;
      challenge = new SchurChallenge(canvas, currentDimensions);

      // Restore settings
      if (gridToggle) challenge.setGridEnabled(gridToggle.checked);
      if (mobileViewToggle) challenge.setMobileViewEnabled(mobileViewToggle.checked);
      if (mobileOverlayToggle) challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);

      // Update subtitle
      updateSubtitle(currentDimensions);

      // Start the new challenge
      challenge.start();
    }
  });

  // Grid toggle wiring
  if (gridToggle) {
    gridToggle.addEventListener('change', () => {
      challenge.setGridEnabled(gridToggle.checked);
    });
  }

  // Mobile view toggle wiring
  if (mobileViewToggle) {
    mobileViewToggle.addEventListener('change', () => {
      challenge.setMobileViewEnabled(mobileViewToggle.checked);
    });
  }

  // Mobile overlay toggle wiring
  if (mobileOverlayToggle) {
    mobileOverlayToggle.addEventListener('change', () => {
      challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);
    });
  }

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
  if (scrollHint) {
    window.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint);
    updateScrollHint();
  }

  // Start challenge loop
  challenge.start();

  console.log('🔄 Schur Decomposition Challenge initialized!');
  console.log('Find the invariant subspaces!');

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
