/**
 * WASM-accelerated geodesic distance calculations
 * Provides the same API as geodesic.js but uses Rust/WASM for performance
 */

let wasmModule = null;
let wasmInitialized = false;

/**
 * Initialize the WASM module
 * @returns {Promise<boolean>} true if initialized successfully, false otherwise
 */
export async function initWasm() {
  if (wasmInitialized) {
    return true;
  }

  try {
    // Dynamic import of WASM module
    const wasm = await import('../wasm-logm/pkg/wasm_logm.js');

    // For Node.js environment (tests), we need to load the WASM file manually
    if (typeof process !== 'undefined' && process.versions?.node) {
      const { readFileSync } = await import('fs');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      // Get the directory of this module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Read the WASM file
      const wasmFilePath = join(__dirname, '../wasm-logm/pkg/wasm_logm_bg.wasm');
      const wasmBytes = readFileSync(wasmFilePath);

      // Initialize with the bytes
      await wasm.default(wasmBytes);
    } else {
      // Browser environment
      await wasm.default();
    }

    wasmModule = wasm;
    wasmInitialized = true;
    console.log('WASM logm module initialized successfully');
    return true;
  } catch (error) {
    console.warn('Failed to initialize WASM module:', error.message || error);
    console.warn('Falling back to mathjs implementation');
    return false;
  }
}

/**
 * Convert a 2D array to flat Float64Array (row-major)
 */
function matrixToFlat(matrix) {
  const n = matrix.length;
  const flat = new Float64Array(n * n);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      flat[idx++] = matrix[i][j];
    }
  }
  return flat;
}

/**
 * Convert flat Float64Array to 2D array
 */
function flatToMatrix(flat, n) {
  const matrix = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(flat[idx++]);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Geodesic distance between two rotation matrices using WASM
 * 
 * **Important**: This method only works correctly for orthogonal matrices.
 * 
 * @param {Array} R - 2D array representing first rotation matrix
 * @param {Array} T - 2D array representing second rotation matrix
 * @returns {number} geodesic distance
 */
export function geodesicDistanceWasm(R, T) {
  if (!wasmInitialized) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }

  const n = R.length;
  const R_flat = matrixToFlat(R);
  const T_flat = matrixToFlat(T);

  return wasmModule.geodesic_distance(R_flat, T_flat, n);
}

/**
 * Geodesic interpolation between two rotations using WASM
 * 
 * **Important**: This method only works correctly for orthogonal matrices.
 * 
 * @param {Array} A - 2D array representing start rotation matrix
 * @param {Array} B - 2D array representing end rotation matrix
 * @param {number} t - interpolation parameter (0 = A, 1 = B)
 * @returns {Array} 2D array representing interpolated rotation
 */
export function geodesicInterpWasm(A, B, t) {
  if (!wasmInitialized) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }

  const n = A.length;
  const A_flat = matrixToFlat(A);
  const B_flat = matrixToFlat(B);

  const result_flat = wasmModule.geodesic_interp(A_flat, B_flat, t, n);
  return flatToMatrix(result_flat, n);
}

/**
 * Matrix logarithm using WASM
 * 
 * **Important**: This method only works correctly for orthogonal matrices.
 * 
 * Returns complex matrix as [real, imag] pairs
 * @param {Array} M - 2D array representing matrix
 * @returns {Array} Flat array with interleaved [real, imag] values
 */
export function matrixLogmWasm(M) {
  if (!wasmInitialized) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }

  const n = M.length;
  const M_flat = matrixToFlat(M);

  return wasmModule.matrix_logm(M_flat, n);
}

/**
 * Matrix exponential using WASM
 * @param {Array} M - 2D array representing matrix
 * @returns {Array} 2D array result
 */
export function matrixExpmWasm(M) {
  if (!wasmInitialized) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }

  const n = M.length;
  const M_flat = matrixToFlat(M);

  const result_flat = wasmModule.matrix_expm(M_flat, n);
  return flatToMatrix(result_flat, n);
}

/**
 * Check if WASM is available and initialized
 * @returns {boolean}
 */
export function isWasmAvailable() {
  return wasmInitialized;
}
