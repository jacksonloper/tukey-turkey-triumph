/**
 * Geodesic distance calculations for unitary/orthogonal matrices
 * Uses matrix logarithm and matrix exponential for proper distance on SO(n)
 *
 * Prefers WASM implementation for performance, falls back to mathjs
 */

import * as math from 'mathjs';
import {
  initWasm,
  isWasmAvailable,
  geodesicDistanceWasm,
  geodesicInterpWasm
} from './geodesic-wasm.js';

// Try to initialize WASM on module load
let wasmInitPromise = null;
if (typeof window !== 'undefined') {
  // Browser environment - initialize asynchronously
  wasmInitPromise = initWasm().catch(() => {
    console.log('WASM not available, using mathjs for geodesic operations');
  });
}

//------------------------------------------------------------
//  logUnitary(U): matrix log for unitary matrices
//------------------------------------------------------------

/**
 * Compute matrix logarithm for unitary/orthogonal matrices
 * NOTE: Standard mathjs does not include logm - this function requires WASM support
 * or will throw an error. Use geodesicDistanceArray/geodesicInterpArray which
 * handle WASM initialization automatically.
 *
 * @param {Object} U - mathjs matrix (unitary or orthogonal)
 * @returns {Object} mathjs matrix representing log(U)
 */
export function logUnitary(U) {
  // Check if mathjs has logm (custom fork) - if not, suggest using WASM
  if (typeof math.logm !== 'function') {
    throw new Error(
      'Matrix logarithm (logm) not available in standard mathjs. ' +
      'Use geodesicDistanceArray/geodesicInterpArray which use WASM implementation.'
    );
  }
  return math.logm(U);
}

//------------------------------------------------------------
// Frobenius norm
//------------------------------------------------------------

/**
 * Compute Frobenius norm of a matrix: sqrt(sum of |elements|^2)
 * Uses mathjs's built-in norm function with 'fro' parameter
 * 
 * @param {Object} M - mathjs matrix
 * @returns {number} Frobenius norm
 */
export function frobeniusNorm(M) {
  return math.norm(M, 'fro');
}

//------------------------------------------------------------
// exp(eps*K) using mathjs
//------------------------------------------------------------

/**
 * Compute matrix exponential exp(eps * K)
 * 
 * @param {Object} K - mathjs matrix (generator, typically skew-Hermitian)
 * @param {number} eps - scalar multiplier
 * @returns {Object} mathjs matrix exp(eps*K)
 */
export function expOfScaled(K, eps) {
  return math.expm(math.multiply(K, eps));
}

//------------------------------------------------------------
// H(eps) = R * exp(eps*K)
//------------------------------------------------------------

/**
 * Compute perturbed rotation H(eps) = R * exp(eps*K)
 * 
 * @param {Object} R - mathjs matrix (base rotation)
 * @param {Object} K - mathjs matrix (generator/swivel direction)
 * @param {number} eps - perturbation parameter
 * @returns {Object} mathjs matrix H(eps)
 */
export function H(R, K, eps) {
  return math.multiply(R, expOfScaled(K, eps));
}

//------------------------------------------------------------
// Geodesic distance d(R,T) = || log(R^* T) ||_F
//------------------------------------------------------------

/**
 * Compute geodesic distance between two rotation matrices
 * d(R,T) = || log(R^* T) ||_F
 * where R^* is the conjugate transpose (for real matrices, just transpose)
 * 
 * @param {Object} R - mathjs matrix (first rotation)
 * @param {Object} T - mathjs matrix (second rotation)
 * @returns {number} geodesic distance
 */
export function geodesicDistance(R, T) {
  const Rstar = math.ctranspose(R);
  const U = math.multiply(Rstar, T);
  const logU = logUnitary(U);
  return frobeniusNorm(logU);
}

//------------------------------------------------------------
// Numerical derivative of d(H(eps),T) at eps=0
//------------------------------------------------------------

/**
 * Compute numerical derivative of geodesic distance at eps=0
 * Uses central difference: d'(0) ≈ [d(H(h),T) - d(H(-h),T)] / (2h)
 * 
 * @param {Object} R - mathjs matrix (base rotation)
 * @param {Object} T - mathjs matrix (target rotation)
 * @param {Object} K - mathjs matrix (generator/swivel direction)
 * @param {number} h - step size for finite difference (default 1e-6)
 * @returns {number} derivative of distance with respect to swivel parameter
 */
export function dGeodesicAtZero(R, T, K, h = 1e-6) {
  const Hp = H(R, K, h);
  const Hm = H(R, K, -h);

  const dp = geodesicDistance(Hp, T);
  const dm = geodesicDistance(Hm, T);

  return (dp - dm) / (2 * h);
}

//------------------------------------------------------------
// Geodesic interpolation on SO(n)
//------------------------------------------------------------

/**
 * Geodesic interpolation between two rotation matrices on SO(n)
 * Uses matrix logarithm and exponential for proper geodesic path
 * 
 * The geodesic path from A to B at parameter t is:
 * result = A * expm(t * logm(A^T * B))
 * 
 * @param {Object} A - mathjs matrix (start rotation)
 * @param {Object} B - mathjs matrix (end rotation)
 * @param {number} t - interpolation parameter (0 = A, 1 = B)
 * @returns {Object} mathjs matrix (interpolated rotation)
 */
export function geodesicInterp(A, B, t) {
  // Compute relative rotation: R_rel = A^T * B
  const AT = math.ctranspose(A);
  const R_rel = math.multiply(AT, B);
  
  // Take matrix logarithm of relative rotation
  const log_R = math.logm(R_rel);
  
  // Scale by interpolation parameter t
  const scaled_log = math.multiply(log_R, t);
  
  // Exponentiate to get intermediate relative rotation
  const R_interp = math.expm(scaled_log);
  
  // Apply to starting rotation
  const result = math.multiply(A, R_interp);
  
  return result;
}

//------------------------------------------------------------
// Conversion helpers for working with native arrays
//------------------------------------------------------------

/**
 * Convert native 2D array to mathjs matrix
 * 
 * @param {Array} arr - 2D array
 * @returns {Object} mathjs matrix
 */
export function arrayToMathMatrix(arr) {
  return math.matrix(arr);
}

/**
 * Convert mathjs matrix to native 2D array
 * 
 * @param {Object} M - mathjs matrix
 * @returns {Array} 2D array
 */
export function mathMatrixToArray(M) {
  return M.toArray();
}

//------------------------------------------------------------
// Wrapper functions that work with native arrays
//------------------------------------------------------------

/**
 * Geodesic distance between two rotations (native array version)
 * Uses WASM when available, falls back to mathjs
 *
 * @param {Array} R - 2D array representing first rotation matrix
 * @param {Array} T - 2D array representing second rotation matrix
 * @returns {number} geodesic distance
 */
export function geodesicDistanceArray(R, T) {
  // Use WASM if available for better performance
  if (isWasmAvailable()) {
    return geodesicDistanceWasm(R, T);
  }

  // Fall back to mathjs
  const R_math = arrayToMathMatrix(R);
  const T_math = arrayToMathMatrix(T);
  return geodesicDistance(R_math, T_math);
}

/**
 * Derivative of geodesic distance at eps=0 (native array version)
 * 
 * @param {Array} R - 2D array representing base rotation matrix
 * @param {Array} T - 2D array representing target rotation matrix
 * @param {Array} K - 2D array representing generator/swivel direction
 * @param {number} h - step size for finite difference (default 1e-6)
 * @returns {number} derivative of distance
 */
export function dGeodesicAtZeroArray(R, T, K, h = 1e-6) {
  const R_math = arrayToMathMatrix(R);
  const T_math = arrayToMathMatrix(T);
  const K_math = arrayToMathMatrix(K);
  return dGeodesicAtZero(R_math, T_math, K_math, h);
}

/**
 * Geodesic interpolation between two rotations (native array version)
 * Uses WASM when available, falls back to mathjs
 *
 * @param {Array} A - 2D array representing start rotation matrix
 * @param {Array} B - 2D array representing end rotation matrix
 * @param {number} t - interpolation parameter (0 = A, 1 = B)
 * @returns {Array} 2D array representing interpolated rotation
 */
export function geodesicInterpArray(A, B, t) {
  // Use WASM if available for better performance
  if (isWasmAvailable()) {
    return geodesicInterpWasm(A, B, t);
  }

  // Fall back to mathjs
  const A_math = arrayToMathMatrix(A);
  const B_math = arrayToMathMatrix(B);
  const result_math = geodesicInterp(A_math, B_math, t);
  return mathMatrixToArray(result_math);
}
