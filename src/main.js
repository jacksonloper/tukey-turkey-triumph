/**
 * Tukey's Turkey Triumph - Main Entry Point
 * A 4D navigation game using the Draughtsman's Display
 */

import './style.css';
import { Game } from './game.js';

// Initialize game when DOM is ready
function init() {
  const canvas = document.getElementById('game-canvas');
  const goButton = document.getElementById('go-button');
  const scrollHint = document.getElementById('scroll-hint');
  const shipRadios = document.querySelectorAll('input[name="ship"]');
  const dimensionSelect = document.getElementById('dimension-select');
  const subtitle = document.getElementById('subtitle');

  // Create game instance
  let currentDimensions = parseInt(dimensionSelect.value) || 4;
  let game = new Game(canvas, currentDimensions);

  // Update subtitle to reflect current dimension
  function updateSubtitle(dim) {
    const superscripts = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
    subtitle.textContent = `Navigate R${superscripts[dim] || dim} • Rotate the Basis • Pardon Turkeys`;
  }
  updateSubtitle(currentDimensions);

  // Set up controls - continuous movement on 'W' hold
  let wPressed = false;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' && !wPressed) {
      e.preventDefault();
      wPressed = true;
      game.setMovingForward(true);
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') {
      e.preventDefault();
      wPressed = false;
      game.setMovingForward(false);
    }
  });

  // Button also triggers movement while held (pointer events for mobile + desktop)
  goButton.addEventListener('pointerdown', (e) => {
    if (e.cancelable) e.preventDefault();
    try { goButton.setPointerCapture(e.pointerId); } catch {}
    game.setMovingForward(true);
  });

  const stopForward = (e) => {
    game.setMovingForward(false);
    try { goButton.releasePointerCapture(e.pointerId); } catch {}
  };

  goButton.addEventListener('pointerup', stopForward);
  goButton.addEventListener('pointercancel', stopForward);
  goButton.addEventListener('pointerleave', stopForward);

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
  // Run once on load in case we're already scrolled
  updateScrollHint();

  // Start game loop
  game.start();

  console.log('🦃 Tukey\'s Turkey Triumph initialized!');
  console.log('Navigate 4D space and pardon all turkeys!');

  // Display git hash in footer
  const gitHashEl = document.getElementById('git-hash');
  if (gitHashEl) {
    // __GIT_HASH__ is defined by vite.config.js
    gitHashEl.textContent = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'unknown';
  }

  // Ship toggle wiring
  shipRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        game.setShipType(r.value);
      }
    });
  });

  // Dimension selector wiring
  dimensionSelect.addEventListener('change', () => {
    const newDimensions = parseInt(dimensionSelect.value);
    if (newDimensions !== currentDimensions) {
      // Stop the current game
      game.running = false;

      // Create a new game with the new dimensions
      currentDimensions = newDimensions;
      game = new Game(canvas, currentDimensions);

      // Update subtitle
      updateSubtitle(currentDimensions);

      // Reattach ship type
      const selectedShip = document.querySelector('input[name="ship"]:checked');
      if (selectedShip) {
        game.setShipType(selectedShip.value);
      }

      // Start the new game
      game.start();
    }
  });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
