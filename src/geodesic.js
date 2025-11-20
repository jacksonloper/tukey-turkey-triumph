/**
 * Geodesic distance calculations for unitary/orthogonal matrices
 * Uses matrix logarithm and matrix exponential for proper distance on SO(n)
 * 
 * Requires: mathjs and numeric.js
 */

import * as math from 'mathjs';
import numeric from 'numeric';

//------------------------------------------------------------
//  Helpers: conversion between mathjs <-> numeric.js complex
//  (Reserved for future complex matrix support)
//------------------------------------------------------------

/**
 * Convert mathjs matrix to numeric.js complex matrix format
 * Currently unused but kept for potential future support of complex unitary matrices
 */
function mathToNumericComplexMatrix(M) {
  const rows = M.size()[0];
  const cols = M.size()[1];
  const out = new Array(rows);

  for (let i = 0; i < rows; i++) {
    out[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      const z = M.get([i, j]);  // {re, im} or real number
      if (typeof z === "number") {
        out[i][j] = new numeric.T(z, 0);
      } else {
        out[i][j] = new numeric.T(z.re, z.im);
      }
    }
  }
  return out;
}

/**
 * Convert numeric.js complex matrix to mathjs matrix format
 * Currently unused but kept for potential future support of complex unitary matrices
 */
function numericToMathComplexMatrix(M) {
  const rows = M.length;
  const cols = M[0].length;
  return math.matrix(
    M.map(row =>
      row.map(z => math.complex(z.x, z.y))
    )
  );
}

//------------------------------------------------------------
//  logUnitary(U): matrix log for unitary matrices
//------------------------------------------------------------

/**
 * Compute matrix logarithm for unitary matrices
 * Uses eigendecomposition: log(U) = V * diag(i*theta_j) * V^{-1}
 * where theta_j = arg(lambda_j) are the principal arguments of eigenvalues
 * 
 * @param {Object} U - mathjs matrix (unitary or orthogonal)
 * @returns {Object} mathjs matrix representing log(U)
 */
export function logUnitary(U) {
  // Convert mathjs matrix to plain array for numeric.js
  const U_array = U.toArray();
  const n = U_array.length;

  // Check if U is close to identity - if so, log(U) ≈ 0
  let isIdentity = true;
  for (let i = 0; i < n && isIdentity; i++) {
    for (let j = 0; j < n && isIdentity; j++) {
      const expected = i === j ? 1 : 0;
      if (Math.abs(U_array[i][j] - expected) > 1e-10) {
        isIdentity = false;
      }
    }
  }
  
  if (isIdentity) {
    // Return zero matrix
    return math.matrix(Array.from({ length: n }, () => 
      Array.from({ length: n }, () => math.complex(0, 0))
    ));
  }

  // For real orthogonal matrices, use numeric.eig directly
  // numeric.eig works on real matrices and returns complex eigenvalues/vectors
  const E = numeric.eig(U_array);
  
  // E.lambda is a numeric.T with x (real) and y (imaginary) parts
  // E.E is a numeric.T with x (real) and y (imaginary) eigenvectors
  const lambda_re = E.lambda.x;
  const lambda_im = E.lambda.y || new Array(n).fill(0);
  
  const V_re = E.E.x;
  const V_im = E.E.y || V_re.map(row => new Array(n).fill(0));

  // Build log(diag) - the logarithm of each eigenvalue
  const diagLog_re = new Array(n);
  const diagLog_im = new Array(n);
  
  for (let j = 0; j < n; j++) {
    const re = lambda_re[j];
    const im = lambda_im[j];
    const theta = Math.atan2(im, re); // principal arg in [-pi, pi]
    diagLog_re[j] = 0;       // Real part of i*theta is 0
    diagLog_im[j] = theta;   // Imaginary part of i*theta is theta
  }

  // Create diagonal matrix L = diag(i*theta_j)
  // L is complex: L_re and L_im
  const L_re = Array.from({ length: n }, (_, i) => 
    Array.from({ length: n }, (_, j) => i === j ? diagLog_re[i] : 0)
  );
  const L_im = Array.from({ length: n }, (_, i) => 
    Array.from({ length: n }, (_, j) => i === j ? diagLog_im[i] : 0)
  );

  // Compute V * L (complex multiplication)
  const VL_re = complexMatMul(V_re, V_im, L_re, L_im)[0];
  const VL_im = complexMatMul(V_re, V_im, L_re, L_im)[1];

  // Compute V^{-1} using numeric.T operations
  const V_T = new numeric.T(V_re, V_im);
  const Vinv_T = V_T.inv();
  const Vinv_re = Vinv_T.x;
  const Vinv_im = Vinv_T.y || V_re.map(row => new Array(n).fill(0));

  // Check for NaN in inverse (indicates singular matrix)
  let hasNaN = false;
  for (let i = 0; i < n && !hasNaN; i++) {
    for (let j = 0; j < n && !hasNaN; j++) {
      if (isNaN(Vinv_re[i][j]) || (Vinv_im && isNaN(Vinv_im[i][j]))) {
        hasNaN = true;
      }
    }
  }
  
  if (hasNaN) {
    // Fallback: numeric.js eigendecomposition failed (singular eigenvector matrix)
    // This shouldn't happen for proper rotation matrices, but if it does,
    // we cannot compute the logarithm reliably with our current approach.
    // Return zero matrix as a conservative fallback.
    console.warn('Warning: eigendecomposition produced singular eigenvector matrix. Returning zero.');
    return math.matrix(Array.from({ length: n }, () => 
      Array.from({ length: n }, () => math.complex(0, 0))
    ));
  }

  // Compute VL * V^{-1} (complex multiplication)
  const result_re = complexMatMul(VL_re, VL_im, Vinv_re, Vinv_im)[0];
  const result_im = complexMatMul(VL_re, VL_im, Vinv_re, Vinv_im)[1];

  // Convert back to mathjs matrix
  return math.matrix(
    result_re.map((row, i) =>
      row.map((val, j) => math.complex(val, result_im[i][j]))
    )
  );
}

/**
 * Complex matrix multiplication: (A_re + i*A_im) * (B_re + i*B_im)
 * Returns [C_re, C_im] where C = A * B
 */
function complexMatMul(A_re, A_im, B_re, B_im) {
  const n = A_re.length;
  const m = B_re[0].length;
  const k = A_re[0].length;
  
  const C_re = Array.from({ length: n }, () => new Array(m).fill(0));
  const C_im = Array.from({ length: n }, () => new Array(m).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let re = 0;
      let im = 0;
      for (let p = 0; p < k; p++) {
        // (a + bi)(c + di) = (ac - bd) + (ad + bc)i
        const a = A_re[i][p];
        const b = A_im[i][p];
        const c = B_re[p][j];
        const d = B_im[p][j];
        re += a * c - b * d;
        im += a * d + b * c;
      }
      C_re[i][j] = re;
      C_im[i][j] = im;
    }
  }
  
  return [C_re, C_im];
}

//------------------------------------------------------------
// Frobenius norm
//------------------------------------------------------------

/**
 * Compute Frobenius norm of a matrix: sqrt(sum of |elements|^2)
 * Handles complex matrices properly
 * 
 * @param {Object} M - mathjs matrix
 * @returns {number} Frobenius norm
 */
export function frobeniusNorm(M) {
  let acc = 0;
  const rows = M.size()[0];
  const cols = M.size()[1];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const z = M.get([i, j]);
      const re = z.re !== undefined ? z.re : z;
      const im = z.im !== undefined ? z.im : 0;
      acc += re * re + im * im;
    }
  }
  return Math.sqrt(acc);
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
 * 
 * @param {Array} R - 2D array representing first rotation matrix
 * @param {Array} T - 2D array representing second rotation matrix
 * @returns {number} geodesic distance
 */
export function geodesicDistanceArray(R, T) {
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
