import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

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
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  plugins: [
    {
      name: 'copy-wasm',
      writeBundle() {
        // Copy WASM files to dist after build
        const wasmSrc = 'wasm-logm/pkg';
        const wasmDest = 'dist/wasm-logm';

        if (existsSync(wasmSrc)) {
          mkdirSync(wasmDest, { recursive: true });

          const files = ['wasm_logm_bg.wasm', 'wasm_logm.js', 'wasm_logm.d.ts'];
          files.forEach(file => {
            try {
              copyFileSync(`${wasmSrc}/${file}`, `${wasmDest}/${file}`);
              console.log(`Copied ${file} to dist`);
            } catch (err) {
              console.warn(`Could not copy ${file}:`, err.message);
            }
          });
        } else {
          console.warn('WASM package not found. Run npm run build:wasm first.');
        }
      },
    },
  ],
});
