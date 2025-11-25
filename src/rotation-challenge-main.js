/**
 * Rotation Matching Challenge - Main Entry Point
 */

import './style.css';
import { RotationChallenge } from './rotation-challenge.js';
import { ensureWasmInitialized } from './geodesic.js';

// Initialize challenge when DOM is ready
async function init() {
  // Wait for WASM to initialize before starting the game
  await ensureWasmInitialized();
  const canvas = document.getElementById('game-canvas');
  const newChallengeButton = document.getElementById('new-challenge-button');
  const halfDistanceButton = document.getElementById('half-distance-button');
  const dimensionSelect = document.getElementById('dimension-select');
  const displayModeSelect = document.getElementById('display-mode-select');
  const gridToggle = document.getElementById('grid-toggle');
  const mobileViewToggle = document.getElementById('mobile-view-toggle');
  const mobileOverlayToggle = document.getElementById('mobile-overlay-toggle');
  const gradientWidgetToggle = document.getElementById('gradient-widget-toggle');
  const distanceInfoToggle = document.getElementById('distance-info-toggle');
  const autoLockToggle = document.getElementById('auto-lock-toggle');
  const autoLockThresholdInput = document.getElementById('auto-lock-threshold-input');
  const autoLockThresholdContainer = document.querySelector('.auto-lock-threshold');
  const turkeyTrailToggle = document.getElementById('turkey-trail-toggle');
  const subtitle = document.getElementById('subtitle');
  const scrollHint = document.getElementById('scroll-hint');

  // Create challenge instance
  let currentDimensions = parseInt(dimensionSelect.value) || 4;
  let challenge = new RotationChallenge(canvas, currentDimensions);
  
  // Initialize with current UI state
  challenge.setDisplayMode(displayModeSelect.value);
  challenge.setGridEnabled(gridToggle.checked);
  challenge.setMobileViewEnabled(mobileViewToggle.checked);
  challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);
  challenge.setGradientWidgetEnabled(gradientWidgetToggle.checked);
  challenge.setShowDistanceInfo(distanceInfoToggle.checked);
  challenge.setAutoLockEnabled(autoLockToggle.checked);
  challenge.setAutoLockThreshold(parseFloat(autoLockThresholdInput.value));
  if (turkeyTrailToggle) {
    challenge.setTurkeyTrailEnabled(turkeyTrailToggle.checked);
  }

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
      
      // Restore display mode and grid settings
      challenge.setDisplayMode(displayModeSelect.value);
      challenge.setGridEnabled(gridToggle.checked);
      challenge.setMobileViewEnabled(mobileViewToggle.checked);
      challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);
      challenge.setGradientWidgetEnabled(gradientWidgetToggle.checked);
      challenge.setShowDistanceInfo(distanceInfoToggle.checked);
      challenge.setAutoLockEnabled(autoLockToggle.checked);
      challenge.setAutoLockThreshold(parseFloat(autoLockThresholdInput.value));
      if (turkeyTrailToggle) {
        challenge.setTurkeyTrailEnabled(turkeyTrailToggle.checked);
      }

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

  // Mobile view toggle wiring
  mobileViewToggle.addEventListener('change', () => {
    challenge.setMobileViewEnabled(mobileViewToggle.checked);
  });

  // Mobile overlay toggle wiring
  mobileOverlayToggle.addEventListener('change', () => {
    challenge.setMobileOverlayEnabled(mobileOverlayToggle.checked);
  });

  // Gradient widget toggle wiring
  gradientWidgetToggle.addEventListener('change', () => {
    challenge.setGradientWidgetEnabled(gradientWidgetToggle.checked);
  });

  // Distance info toggle wiring
  distanceInfoToggle.addEventListener('change', () => {
    challenge.setShowDistanceInfo(distanceInfoToggle.checked);
  });

  // Auto-lock toggle wiring
  autoLockToggle.addEventListener('change', () => {
    challenge.setAutoLockEnabled(autoLockToggle.checked);
    // Show/hide threshold input
    if (autoLockToggle.checked) {
      autoLockThresholdContainer.style.display = 'flex';
    } else {
      autoLockThresholdContainer.style.display = 'none';
    }
  });

  // Auto-lock threshold input wiring
  autoLockThresholdInput.addEventListener('change', () => {
    const threshold = parseFloat(autoLockThresholdInput.value);
    if (!isNaN(threshold) && threshold > 0) {
      challenge.setAutoLockThreshold(threshold);
    }
  });

  // Turkey trail toggle wiring
  if (turkeyTrailToggle) {
    turkeyTrailToggle.addEventListener('change', () => {
      challenge.setTurkeyTrailEnabled(turkeyTrailToggle.checked);
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
