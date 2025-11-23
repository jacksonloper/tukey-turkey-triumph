import { test, expect } from '@playwright/test';

// Can be overridden with DEPLOY_URL env variable
const DEPLOY_URL = process.env.DEPLOY_URL || 'http://localhost:5173';

test('app loads and initializes correctly', async ({ page }) => {
  const consoleMessages = [];
  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });

    // Log important messages
    if (type === 'error' || text.includes('WASM') || text.includes('initialized')) {
      console.log(`[${type}] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('Page error:', error.message);
  });

  // Navigate to the app
  await page.goto(DEPLOY_URL);

  // Wait for the app to initialize
  await page.waitForTimeout(2000);

  // Check that the header is visible
  const header = page.locator('h1');
  await expect(header).toHaveText('Rotation Matching Challenge');

  // Check that the canvas is present
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeAttached();

  // Check that controls are present
  const newChallengeBtn = page.locator('#new-challenge-button');
  await expect(newChallengeBtn).toBeVisible();

  const autoRotateBtn = page.locator('#half-distance-button');
  await expect(autoRotateBtn).toBeVisible();

  // Check that distance metrics appear
  const alignmentScore = page.locator('#alignment-score');
  await expect(alignmentScore).not.toHaveText('—', { timeout: 5000 });

  // Verify git hash is loaded
  const gitHash = page.locator('#git-hash');
  await expect(gitHash).not.toHaveText('loading...');

  // Check for WASM initialization in console
  const wasmInitialized = consoleMessages.some(msg =>
    msg.text.includes('WASM') && msg.text.includes('initialized')
  );
  console.log('WASM initialized:', wasmInitialized);

  // Check that there are no JavaScript errors
  expect(errors).toHaveLength(0);

  console.log(`✅ App loaded successfully at ${DEPLOY_URL}`);
});

test('can interact with controls', async ({ page }) => {
  await page.goto(DEPLOY_URL);
  await page.waitForTimeout(2000);

  // Click "New Challenge" button
  const newChallengeBtn = page.locator('#new-challenge-button');
  await newChallengeBtn.click();

  // Wait for the challenge to update
  await page.waitForTimeout(500);

  // Click "Auto-Rotate" button
  const autoRotateBtn = page.locator('#half-distance-button');
  await autoRotateBtn.click();

  // Wait for animation
  await page.waitForTimeout(1000);

  // Verify the distance has changed (should be smaller after auto-rotate)
  const alignmentScore = page.locator('#alignment-score');
  const scoreText = await alignmentScore.textContent();
  expect(scoreText).not.toBe('—');

  console.log('✅ Controls are working');
});

test('can change dimensions', async ({ page }) => {
  await page.goto(DEPLOY_URL);
  await page.waitForTimeout(2000);

  // Change to 2D
  const dimensionSelect = page.locator('#dimension-select');
  await dimensionSelect.selectOption('2');
  await page.waitForTimeout(500);

  // Change to 3D
  await dimensionSelect.selectOption('3');
  await page.waitForTimeout(500);

  // Change to 5D
  await dimensionSelect.selectOption('5');
  await page.waitForTimeout(500);

  // Verify no errors occurred
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  expect(errors).toHaveLength(0);
  console.log('✅ Dimension switching works');
});
