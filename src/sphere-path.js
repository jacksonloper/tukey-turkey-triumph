/**
 * Generate smooth random paths on the unit sphere S^(n-1) in R^n
 */

import { vecN, scaleN } from './math4d.js';

/**
 * Generate a smooth random path
 * For 2D: path stays inside ball (more freedom of movement)
 * For 3D+: path on sphere surface (better visibility in higher dimensions)
 *
 * @param {number} dimensions - Ambient dimension n
 * @param {number} numPoints - Number of points to sample along the path
 * @param {number} numFrequencies - Number of Fourier modes (controls smoothness)
 * @param {number} radius - Radius (default 3.0 for visibility)
 * @returns {Array} Array of points
 */
export function generateSpherePath(dimensions, numPoints = 100, numFrequencies = 3, radius = 3.0) {
  const onSurface = dimensions >= 3; // Use surface for 3D and higher

  // Generate random Fourier coefficients for each dimension
  const coefficients = [];
  for (let d = 0; d < dimensions; d++) {
    const cosCoeffs = [];
    const sinCoeffs = [];
    for (let k = 0; k <= numFrequencies; k++) {
      if (onSurface) {
        // For sphere surface, use larger coefficients
        cosCoeffs.push((Math.random() - 0.5) * 2);
        sinCoeffs.push((Math.random() - 0.5) * 2);
      } else {
        // For inside ball, use controlled amplitude
        const maxRadius = radius * 0.7;
        const amplitude = maxRadius / (numFrequencies * Math.sqrt(dimensions));
        cosCoeffs.push((Math.random() - 0.5) * 2 * amplitude);
        sinCoeffs.push((Math.random() - 0.5) * 2 * amplitude);
      }
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

    // Normalize based on strategy
    const norm = Math.sqrt(point.reduce((sum, x) => sum + x * x, 0));
    if (onSurface) {
      // Project onto sphere surface
      const normalized = point.map(x => (x / norm) * radius);
      path.push(normalized);
    } else {
      // Keep inside ball, clip if needed
      if (norm > radius) {
        const scale = radius / norm;
        point.forEach((val, idx) => point[idx] = val * scale);
      }
      path.push(point);
    }
  }

  return path;
}

/**
 * Compute determinant of a matrix
 * Uses cofactor expansion for general n
 */
function determinant(mat) {
  const n = mat.length;

  if (n === 1) return mat[0][0];
  if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];

  // For n >= 3, use cofactor expansion along first row
  let det = 0;
  for (let j = 0; j < n; j++) {
    // Create minor matrix (remove row 0, column j)
    const minor = [];
    for (let i = 1; i < n; i++) {
      const row = [];
      for (let k = 0; k < n; k++) {
        if (k !== j) row.push(mat[i][k]);
      }
      minor.push(row);
    }
    const cofactor = Math.pow(-1, j) * mat[0][j] * determinant(minor);
    det += cofactor;
  }
  return det;
}

/**
 * Sample a random rotation matrix from SO(n) using the Haar measure
 * Uses QR decomposition with determinant check for proper rotations
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

    // Add to Q matrix (store as rows)
    for (let i = 0; i < n; i++) {
      if (!Q[i]) Q[i] = [];
      Q[i][j] = q[i];
    }
  }

  // Ensure det(Q) = 1 (proper rotation, not reflection)
  const det = determinant(Q);
  if (det < 0) {
    // Flip last column to make det = 1
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

/**
 * Compute cumulative arc length along a path
 * Returns an array of cumulative distances from the start
 * @param {Array} path - Array of n-dimensional points
 * @returns {Array} Cumulative arc lengths [0, d1, d1+d2, ..., total_length]
 */
export function computeArcLengths(path) {
  const arcLengths = [0];
  let cumulative = 0;
  
  for (let i = 1; i < path.length; i++) {
    const dist = Math.sqrt(
      path[i].reduce((sum, val, j) => sum + (val - path[i-1][j]) ** 2, 0)
    );
    cumulative += dist;
    arcLengths.push(cumulative);
  }
  
  return arcLengths;
}

/**
 * Resample a path to have evenly-spaced points based on arc length
 * This eliminates jittering in animations by ensuring uniform segment lengths
 * @param {Array} path - Array of n-dimensional points
 * @param {number} numSamples - Number of points in resampled path
 * @returns {Array} Resampled path with evenly-spaced points
 */
export function resamplePathUniformly(path, numSamples = 100) {
  if (path.length < 2) return path;
  
  // Compute arc lengths
  const arcLengths = computeArcLengths(path);
  const totalLength = arcLengths[arcLengths.length - 1];
  
  if (totalLength === 0) return path;
  
  const resampledPath = [];
  
  // Sample at evenly-spaced arc length positions
  for (let i = 0; i < numSamples; i++) {
    const targetLength = (i / (numSamples - 1)) * totalLength;
    
    // Find the segment containing this arc length
    let segmentIndex = 0;
    for (let j = 0; j < arcLengths.length - 1; j++) {
      if (arcLengths[j] <= targetLength && targetLength <= arcLengths[j + 1]) {
        segmentIndex = j;
        break;
      }
    }
    
    // Interpolate within the segment
    const segmentStart = arcLengths[segmentIndex];
    const segmentEnd = arcLengths[segmentIndex + 1];
    const segmentLength = segmentEnd - segmentStart;
    
    let t;
    if (segmentLength > 0) {
      t = (targetLength - segmentStart) / segmentLength;
    } else {
      t = 0;
    }
    
    // Lerp between the two points
    const p0 = path[segmentIndex];
    const p1 = path[segmentIndex + 1];
    const interpolated = p0.map((val, dim) => val + t * (p1[dim] - val));
    
    resampledPath.push(interpolated);
  }
  
  return resampledPath;
}
