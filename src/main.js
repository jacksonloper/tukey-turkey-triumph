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

  // Create game instance
  const game = new Game(canvas);

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

  // Button also triggers movement while held
  goButton.addEventListener('mousedown', () => {
    game.setMovingForward(true);
  });

  goButton.addEventListener('mouseup', () => {
    game.setMovingForward(false);
  });

  goButton.addEventListener('mouseleave', () => {
    game.setMovingForward(false);
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
  // Run once on load in case we're already scrolled
  updateScrollHint();

  // Start game loop
  game.start();

  console.log('🦃 Tukey\'s Turkey Triumph initialized!');
  console.log('Navigate 4D space and pardon all turkeys!');

  // Ship toggle wiring
  shipRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        game.setShipType(r.value);
      }
    });
  });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
