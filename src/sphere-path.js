/**
 * Generate smooth random paths on the unit sphere S^(n-1) in R^n
 */

import { vecN, scaleN } from './math4d.js';

/**
 * Generate a smooth random path on the unit sphere
 * Uses a Fourier series approach: smooth functions in each coordinate, then normalize
 *
 * @param {number} dimensions - Ambient dimension n (path lives on S^(n-1))
 * @param {number} numPoints - Number of points to sample along the path
 * @param {number} numFrequencies - Number of Fourier modes (controls smoothness)
 * @param {number} radius - Radius of the sphere (default 3.0 for visibility)
 * @returns {Array} Array of points on the sphere
 */
export function generateSpherePath(dimensions, numPoints = 100, numFrequencies = 3, radius = 3.0) {
  // Generate random Fourier coefficients for each dimension
  const coefficients = [];
  for (let d = 0; d < dimensions; d++) {
    const cosCoeffs = [];
    const sinCoeffs = [];
    for (let k = 0; k <= numFrequencies; k++) {
      cosCoeffs.push((Math.random() - 0.5) * 2);
      sinCoeffs.push((Math.random() - 0.5) * 2);
    }
    coefficients.push({ cos: cosCoeffs, sin: sinCoeffs });
  }

  // Generate path points
  const path = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * 2 * Math.PI; // Parameter from 0 to 2π

    // Compute each coordinate using Fourier series
    const point = [];
    for (let d = 0; d < dimensions; d++) {
      let value = 0;
      for (let k = 0; k <= numFrequencies; k++) {
        value += coefficients[d].cos[k] * Math.cos(k * t);
        value += coefficients[d].sin[k] * Math.sin(k * t);
      }
      point.push(value);
    }

    // Normalize to project onto unit sphere, then scale to desired radius
    const norm = Math.sqrt(point.reduce((sum, x) => sum + x * x, 0));
    const normalized = point.map(x => (x / norm) * radius);

    path.push(normalized);
  }

  return path;
}

/**
 * Sample a random rotation matrix from SO(n) using the Haar measure
 * Uses QR decomposition with sign correction for uniform sampling
 *
 * @param {number} n - Dimension
 * @returns {Array} n×n rotation matrix
 */
export function sampleRandomRotation(n) {
  // Generate random matrix with Gaussian entries
  const A = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      // Box-Muller transform for Gaussian random numbers
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      row.push(z);
    }
    A.push(row);
  }

  // QR decomposition using Gram-Schmidt
  const Q = [];
  const R = [];

  for (let j = 0; j < n; j++) {
    // Start with column j of A
    let v = [];
    for (let i = 0; i < n; i++) {
      v.push(A[i][j]);
    }

    // Subtract projections onto previous columns
    for (let k = 0; k < j; k++) {
      const dot = v.reduce((sum, val, i) => sum + val * Q[i][k], 0);
      v = v.map((val, i) => val - dot * Q[i][k]);
    }

    // Normalize
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    const q = v.map(x => x / norm);

    // Add to Q matrix (store as columns)
    for (let i = 0; i < n; i++) {
      if (!Q[i]) Q[i] = [];
      Q[i][j] = q[i];
    }

    // Compute R entries
    if (!R[j]) R[j] = [];
    for (let i = 0; i <= j; i++) {
      if (i === j) {
        R[j][j] = norm;
      } else {
        const Acol = [];
        for (let k = 0; k < n; k++) Acol.push(A[k][j]);
        const Qcol = [];
        for (let k = 0; k < n; k++) Qcol.push(Q[k][i]);
        R[i][j] = Acol.reduce((sum, val, k) => sum + val * Qcol[k], 0);
      }
    }
  }

  // Correct signs to ensure det(Q) = 1 (proper rotation, not reflection)
  // Multiply last column by sign of product of diagonal of R
  let diagSign = 1;
  for (let i = 0; i < n; i++) {
    diagSign *= Math.sign(R[i][i]);
  }

  if (diagSign < 0) {
    for (let i = 0; i < n; i++) {
      Q[i][n - 1] *= -1;
    }
  }

  return Q;
}

/**
 * Apply a rotation matrix to a path
 * @param {Array} path - Array of n-dimensional points
 * @param {Array} rotation - n×n rotation matrix
 * @returns {Array} Rotated path
 */
export function rotatePath(path, rotation) {
  return path.map(point => {
    const rotated = [];
    for (let i = 0; i < rotation.length; i++) {
      let sum = 0;
      for (let j = 0; j < point.length; j++) {
        sum += rotation[i][j] * point[j];
      }
      rotated.push(sum);
    }
    return rotated;
  });
}

/**
 * Compute alignment score between two paths (0 to 1, higher is better)
 * Uses average distance between corresponding points
 * @param {Array} path1 - First path
 * @param {Array} path2 - Second path
 * @returns {number} Alignment score (0-1)
 */
export function computeAlignment(path1, path2) {
  if (path1.length !== path2.length) {
    throw new Error('Paths must have same length');
  }

  let totalDist = 0;
  for (let i = 0; i < path1.length; i++) {
    const dist = Math.sqrt(
      path1[i].reduce((sum, val, j) => sum + (val - path2[i][j]) ** 2, 0)
    );
    totalDist += dist;
  }

  const avgDist = totalDist / path1.length;

  // Maximum distance between points on unit sphere is 2
  // Convert to percentage: 0 distance = 100%, 2 distance = 0%
  const score = Math.max(0, 1 - avgDist / 2);
  return score;
}
