# E2E Tests

End-to-end tests for the Rotation Matching Challenge using Playwright.

## Running Tests

### Against deployed site
```bash
DEPLOY_URL=https://your-site.netlify.app npm run test:e2e
```

### Against local dev server
```bash
# Start dev server in one terminal
npm run dev

# Run tests in another terminal
npm run test:e2e:local
```

### With UI mode
```bash
npm run test:e2e:ui
```

## Note on WASM

These tests verify that:
- WASM module initializes correctly
- App loads without JavaScript errors
- Basic interactions work (new challenge, auto-rotate, dimension switching)

If tests fail with "Page crashed", this may be due to WASM/Playwright interaction issues in headless mode. The app itself works fine in real browsers.
