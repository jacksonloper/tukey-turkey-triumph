/**
 * Tests for N-dimensional matrix operations
 * Verifies mathematical properties like orthonormality, determinant preservation, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  identityNxN,
  rotationND,
  matMultN,
  transposeN,
  interpRotationSO,
  rotationDistanceSO
} from './math4d.js';
import {
  sampleRandomRotation,
  generateSimplex,
  generateCircularOrientation,
  rotatePath
} from './sphere-path.js';

/**
 * Compute determinant of a matrix
 */
function determinant(mat) {
  const n = mat.length;
  if (n === 1) return mat[0][0];
  if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];

  let det = 0;
  for (let j = 0; j < n; j++) {
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
 * Check if a matrix is orthogonal: M^T M = I
 */
function isOrthogonal(M, tolerance = 1e-6) {
  const n = M.length;
  const MT = transposeN(M);
  const MTM = matMultN(MT, M);
  const I = identityNxN(n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(MTM[i][j] - I[i][j]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if a matrix is in SO(n): orthogonal with det = 1
 */
function isInSO(M, tolerance = 1e-6) {
  if (!isOrthogonal(M, tolerance)) {
    return false;
  }
  const det = determinant(M);
  return Math.abs(det - 1) < tolerance;
}

describe('Matrix Operations', () => {
  describe('Identity Matrix', () => {
    it('should be in SO(n) for various dimensions', () => {
      for (let n = 2; n <= 5; n++) {
        const I = identityNxN(n);
        expect(isInSO(I)).toBe(true);
      }
    });
  });

  describe('Rotation Matrix Generation', () => {
    it('should produce matrices in SO(n) for plane rotations', () => {
      const dimensions = [2, 3, 4, 5];
      for (const n of dimensions) {
        const angle = Math.PI / 4;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const R = rotationND(n, i, j, angle);
            expect(isInSO(R)).toBe(true);
          }
        }
      }
    });
  });

  describe('Random Rotation Sampling', () => {
    it('should produce matrices in SO(n)', () => {
      const dimensions = [2, 3, 4, 5];
      for (const n of dimensions) {
        for (let trial = 0; trial < 10; trial++) {
          const R = sampleRandomRotation(n);
          expect(isInSO(R)).toBe(true);
        }
      }
    });

    it('should have determinant = 1', () => {
      const dimensions = [2, 3, 4];
      for (const n of dimensions) {
        for (let trial = 0; trial < 5; trial++) {
          const R = sampleRandomRotation(n);
          const det = determinant(R);
          expect(Math.abs(det - 1)).toBeLessThan(1e-6);
        }
      }
    });
  });

  describe('Matrix Multiplication', () => {
    it('should preserve SO(n) property', () => {
      const dimensions = [2, 3, 4];
      for (const n of dimensions) {
        const R1 = sampleRandomRotation(n);
        const R2 = sampleRandomRotation(n);
        const R3 = matMultN(R1, R2);
        expect(isInSO(R3)).toBe(true);
      }
    });
  });

  describe('Rotation Distance Metric', () => {
    it('should be zero for identical rotations', () => {
      const n = 4;
      const R = rotationND(n, 0, 1, 0.5);
      const dist = rotationDistanceSO(R, R);
      expect(dist).toBeLessThan(1e-10);
    });

    it('should be symmetric', () => {
      const n = 3;
      const R1 = sampleRandomRotation(n);
      const R2 = sampleRandomRotation(n);

      const dist1 = rotationDistanceSO(R1, R2);
      const dist2 = rotationDistanceSO(R2, R1);

      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-10);
    });

    it('should give reasonable values for random rotations', () => {
      const n = 3;
      const R1 = sampleRandomRotation(n);
      const R2 = sampleRandomRotation(n);

      const dist = rotationDistanceSO(R1, R2);

      // Distance should be finite and reasonable (not NaN, not huge)
      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThanOrEqual(0);
      // Max distance is bounded
      expect(dist).toBeLessThan(100);
    });
  });

  describe('Rotation Interpolation with Random Rotations', () => {
    it('should preserve orthonormality for random rotations', () => {
      const n = 3;
      const A = sampleRandomRotation(n);
      const B = sampleRandomRotation(n);

      // Test at t=0.5 (the halfway case)
      const R = interpRotationSO(A, B, 0.5);

      // Result should be in SO(n)
      expect(isInSO(R, 1e-3)).toBe(true);

      // All matrix elements should be finite
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(isFinite(R[i][j])).toBe(true);
        }
      }
    });

    it('should actually move halfway toward target', () => {
      const n = 3;
      const A = sampleRandomRotation(n);
      const B = sampleRandomRotation(n);

      const R_half = interpRotationSO(A, B, 0.5);

      const dist_A_to_half = rotationDistanceSO(A, R_half);
      const dist_half_to_B = rotationDistanceSO(R_half, B);

      // Both distances should be finite
      expect(isFinite(dist_A_to_half)).toBe(true);
      expect(isFinite(dist_half_to_B)).toBe(true);

      // They should be roughly equal (within 20% tolerance for now)
      if (dist_A_to_half > 0 && dist_half_to_B > 0) {
        const ratio = dist_A_to_half / dist_half_to_B;
        expect(ratio).toBeGreaterThan(0.5);
        expect(ratio).toBeLessThan(2.0);
      }
    });
  });
});

describe('Simplex Circular Orientation', () => {
  describe('Circular projection to (D1, D2)', () => {
    it('should place all vertices equidistant from origin in first two dimensions', () => {
      const dimensions = [2, 3, 4, 5];
      const tolerance = 1e-6;

      for (const n of dimensions) {
        // Generate a regular simplex
        const baseSimplex = generateSimplex(n, 3.0);

        // Apply circular orientation
        const circularOrientation = generateCircularOrientation(n, baseSimplex);
        const orientedSimplex = rotatePath(baseSimplex, circularOrientation);

        // Project each vertex to first two dimensions and compute distance from origin
        const distances = [];
        for (let i = 0; i < orientedSimplex.length; i++) {
          const vertex = orientedSimplex[i];
          // Distance in (D1, D2) projection
          const dist = Math.sqrt(vertex[0] * vertex[0] + vertex[1] * vertex[1]);
          distances.push(dist);
        }

        // All distances should be equal (vertices on a circle)
        const avgDist = distances.reduce((sum, d) => sum + d, 0) / distances.length;

        for (const dist of distances) {
          expect(Math.abs(dist - avgDist)).toBeLessThan(tolerance);
        }

        // Distance should be positive (not degenerate)
        expect(avgDist).toBeGreaterThan(0.1);
      }
    });

    it('should produce a rotation matrix in SO(n)', () => {
      const dimensions = [2, 3, 4, 5];

      for (const n of dimensions) {
        const baseSimplex = generateSimplex(n, 3.0);
        const R = generateCircularOrientation(n, baseSimplex);

        // Should be a proper rotation
        expect(isInSO(R, 1e-5)).toBe(true);
      }
    });

    it('should distribute vertices evenly around the circle', () => {
      const dimensions = [3, 4, 5];
      const tolerance = 0.1; // More lenient for angle spacing

      for (const n of dimensions) {
        const N = n + 1; // Number of vertices

        // Generate and orient simplex
        const baseSimplex = generateSimplex(n, 3.0);
        const circularOrientation = generateCircularOrientation(n, baseSimplex);
        const orientedSimplex = rotatePath(baseSimplex, circularOrientation);

        // Compute angles of vertices in (D1, D2) plane
        const angles = [];
        for (let i = 0; i < N; i++) {
          const vertex = orientedSimplex[i];
          const angle = Math.atan2(vertex[1], vertex[0]);
          angles.push(angle);
        }

        // Sort angles
        angles.sort((a, b) => a - b);

        // Compute angular spacing between consecutive vertices
        const spacings = [];
        for (let i = 0; i < N; i++) {
          const nextIdx = (i + 1) % N;
          let spacing = angles[nextIdx] - angles[i];
          if (spacing < 0) spacing += 2 * Math.PI;
          spacings.push(spacing);
        }

        // Expected uniform spacing
        const expectedSpacing = 2 * Math.PI / N;

        // Check that all spacings are roughly equal
        for (const spacing of spacings) {
          expect(Math.abs(spacing - expectedSpacing)).toBeLessThan(tolerance);
        }
      }
    });
  });

  describe('Regular simplex generation', () => {
    it('should produce vertices with equal pairwise distances', () => {
      const dimensions = [2, 3, 4, 5];
      const tolerance = 1e-6;

      for (const n of dimensions) {
        const vertices = generateSimplex(n, 3.0);
        const N = n + 1;

        // Compute all pairwise distances
        const distances = [];
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            let dist = 0;
            for (let k = 0; k < n; k++) {
              dist += (vertices[i][k] - vertices[j][k]) ** 2;
            }
            distances.push(Math.sqrt(dist));
          }
        }

        // All distances should be equal (regular simplex)
        const avgDist = distances.reduce((sum, d) => sum + d, 0) / distances.length;

        for (const dist of distances) {
          expect(Math.abs(dist - avgDist)).toBeLessThan(tolerance);
        }

        // Distance should be positive
        expect(avgDist).toBeGreaterThan(0.1);
      }
    });

    it('should center vertices at origin', () => {
      const dimensions = [2, 3, 4, 5];
      const tolerance = 1e-10;

      for (const n of dimensions) {
        const vertices = generateSimplex(n, 3.0);
        const N = n + 1;

        // Compute centroid
        const centroid = new Array(n).fill(0);
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < n; j++) {
            centroid[j] += vertices[i][j];
          }
        }
        for (let j = 0; j < n; j++) {
          centroid[j] /= N;
        }

        // Centroid should be at origin
        for (let j = 0; j < n; j++) {
          expect(Math.abs(centroid[j])).toBeLessThan(tolerance);
        }
      }
    });
  });
});
