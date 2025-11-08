import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Get git commit hash (fallback to 'dev' if not in a git repo)
let gitHash = 'dev';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git hash, using "dev"');
}

// Use relative asset paths so the site works under any subpath (GitHub Pages)
export default defineConfig({
  base: './',
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
  },
});
