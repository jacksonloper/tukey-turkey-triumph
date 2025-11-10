/**
 * Generate smooth random paths on the unit sphere S^(n-1) in R^n
 * Also includes simplex generation for geometric challenges
 */

import { vecN, scaleN, identityNxN, rotationND, matMultN } from './math4d.js';

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
 * Generate a regular simplex in n dimensions
 * Uses the canonical construction: p_k = e_k - (1/N)*1 for k=0..N-1
 * This produces a truly regular simplex with all edge lengths equal
 *
 * @param {number} dimensions - Ambient dimension n
 * @param {number} radius - Radius for scaling (default 3.0)
 * @returns {Array} Array of n+1 vertices
 */
export function generateSimplex(dimensions, radius = 3.0) {
  const n = dimensions;
  const N = n + 1;  // Number of vertices

  // Canonical construction: p_k = e_k - (1/N)*1
  // We work in R^N, then project to R^n by dropping last coordinate
  const vertices = [];

  for (let k = 0; k < N; k++) {
    const vertex = new Array(n).fill(0);

    // For k < n: vertex[k] = 1 - 1/N, others = -1/N
    // For k = n: all coordinates = -1/N
    for (let j = 0; j < n; j++) {
      if (j === k) {
        vertex[j] = 1 - 1/N;
      } else {
        vertex[j] = -1/N;
      }
    }

    vertices.push(vertex);
  }

  // Compute current average norm
  let avgNorm = 0;
  for (let i = 0; i < N; i++) {
    const norm = Math.sqrt(vertices[i].reduce((sum, x) => sum + x * x, 0));
    avgNorm += norm;
  }
  avgNorm /= N;

  // Scale to desired radius
  const scale = radius / avgNorm;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < n; j++) {
      vertices[i][j] *= scale;
    }
  }

  return vertices;
}

/**
 * Construct two orthonormal directions using Fourier modes
 * that project an (n+1)-vertex simplex to a regular polygon
 *
 * @param {number} n - Dimension of simplex (vertices = n+1)
 * @param {number} m - Fourier mode (default 1 for simplest)
 * @returns {Object} {u, v} - Two orthonormal direction vectors of length n+1
 */
export function constructFourierDirections(n, m = 1) {
  const N = n + 1;  // Number of vertices

  // Step 1: Build raw Fourier mode components
  const a = new Array(N);
  const b = new Array(N);

  for (let k = 0; k < N; k++) {
    const angle = 2 * Math.PI * m * k / N;
    a[k] = Math.cos(angle);
    b[k] = Math.sin(angle);
  }

  // Optional numerical stabilization (center to ensure sum = 0)
  const meanA = a.reduce((sum, val) => sum + val, 0) / N;
  const meanB = b.reduce((sum, val) => sum + val, 0) / N;

  for (let k = 0; k < N; k++) {
    a[k] -= meanA;
    b[k] -= meanB;
  }

  // Step 2: Normalize to make them orthonormal
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  const u = a.map(val => val / normA);
  const v = b.map(val => val / normB);

  return { u, v };
}

/**
 * Normalize a vector in place
 */
function normalizeInPlace(vec) {
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  if (norm > 1e-10) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
}

/**
 * Solve linear system Ax = b using Gaussian elimination with partial pivoting
 * @param {Array} A - n×n matrix (will be modified)
 * @param {Array} b - n-vector (will be modified)
 * @returns {Array} solution vector x
 */
function gaussianSolve(A, b) {
  const n = A.length;

  // Make copies to avoid modifying originals
  const M = A.map(row => [...row]);
  const y = [...b];

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    [y[i], y[maxRow]] = [y[maxRow], y[i]];

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      y[k] -= factor * y[i];
      for (let j = i; j < n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = y[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }

  return x;
}

/**
 * Generate a rotation matrix that orients a simplex to appear circular in (D1, D2)
 * Uses Fourier mode projection to create regular polygon arrangement
 *
 * @param {number} dimensions - Ambient dimension n
 * @param {Array} vertices - Simplex vertices in R^n
 * @returns {Array} n×n rotation matrix
 */
export function generateCircularOrientation(dimensions, vertices) {
  const n = dimensions;
  const N = n + 1;  // Number of vertices

  // Matrix V: rows are vertices[i] in R^n
  const V = vertices; // shape (N x n)

  // Target regular N-gon angles
  const angles = [];
  for (let k = 0; k < N; k++) {
    angles.push((2 * Math.PI * k) / N);
  }

  // Cos/Sin patterns, centered to lie in the sum-zero subspace
  const cosVals = angles.map(a => Math.cos(a));
  const sinVals = angles.map(a => Math.sin(a));
  const meanCos = cosVals.reduce((s, x) => s + x, 0) / N;
  const meanSin = sinVals.reduce((s, x) => s + x, 0) / N;
  for (let k = 0; k < N; k++) {
    cosVals[k] -= meanCos;
    sinVals[k] -= meanSin;
  }

  // Solve V * a = cosVals,  V * b = sinVals using least squares
  // Build normal equations (V^T V) a = V^T cosVals
  function solveDirection(target) {
    const ATA = Array.from({ length: n }, () => new Array(n).fill(0));
    const ATy = new Array(n).fill(0);

    for (let i = 0; i < N; i++) {
      const row = V[i];
      const ti = target[i];
      for (let j = 0; j < n; j++) {
        ATy[j] += row[j] * ti;
        for (let k = 0; k < n; k++) {
          ATA[j][k] += row[j] * row[k];
        }
      }
    }

    // Solve ATA * x = ATy
    return gaussianSolve(ATA, ATy);
  }

  const dirU = solveDirection(cosVals);
  const dirVraw = solveDirection(sinVals);

  // Orthonormalize dirU, dirV
  normalizeInPlace(dirU);

  let dot = 0;
  for (let i = 0; i < n; i++) dot += dirU[i] * dirVraw[i];
  const dirV = dirVraw.map((v, i) => v - dot * dirU[i]);
  normalizeInPlace(dirV);

  // Build rotation matrix with dirU as first row, dirV as second row
  // Complete with remaining orthonormal vectors via Gram-Schmidt
  const R = [];
  R.push(dirU.slice());
  R.push(dirV.slice());

  // Add remaining basis vectors
  for (let i = 2; i < n; i++) {
    const v = new Array(n).fill(0);
    v[i] = 1;

    // Orthogonalize against all previous rows
    for (let j = 0; j < R.length; j++) {
      let proj = 0;
      for (let k = 0; k < n; k++) proj += v[k] * R[j][k];
      for (let k = 0; k < n; k++) v[k] -= proj * R[j][k];
    }

    normalizeInPlace(v);
    R.push(v);
  }

  return R;
}

/**
 * Generate a rotation that orients a simplex to appear circular in the (x0, x1) projection
 * This creates a nice visualization where vertices are evenly distributed in the first 2D view
 *
 * @param {number} dimensions - Ambient dimension n
 * @returns {Array} n×n rotation matrix
 */
export function generateCircularOrientationOld(dimensions) {
  const n = dimensions;
  let R = identityNxN(n);

  // Apply a series of rotations to spread vertices nicely
  // Rotate from higher dimensions into the (x0, x1) plane

  // For each dimension beyond the second, rotate it partially into the viewing plane
  for (let i = 2; i < n; i++) {
    // Rotate dimension i toward dimension 0
    const angle = Math.PI / (2 * i); // Smaller angles for higher dimensions
    const rot = rotationND(n, 0, i, angle);
    R = matMultN(R, rot);

    // Also rotate dimension i toward dimension 1
    const rot2 = rotationND(n, 1, i, angle * 0.7);
    R = matMultN(R, rot2);
  }

  // Final rotation in the (0,1) plane for nice orientation
  const finalAngle = Math.PI / 8;
  const finalRot = rotationND(n, 0, 1, finalAngle);
  R = matMultN(R, finalRot);

  return R;
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
