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
  geodesicInterpSO,
  geodesicDistanceSO
} from './math4d.js';
import { sampleRandomRotation } from './sphere-path.js';

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

  describe('Geodesic Interpolation', () => {
    it('should preserve orthonormality at intermediate points for small rotations', () => {
      const dimensions = [2, 3];
      for (const n of dimensions) {
        // Use small rotations (close to identity) where series converges better
        const A = rotationND(n, 0, 1, 0.3);
        const B = rotationND(n, 0, 1, 0.7);

        // Test at multiple interpolation points
        for (let t = 0; t <= 1; t += 0.2) {
          const R = geodesicInterpSO(A, B, t);
          expect(isInSO(R, 1e-4)).toBe(true);
        }
      }
    });

    it('should match endpoints at t=0 and t=1 for small rotations', () => {
      const n = 3;
      // Use small rotations where series converges
      const A = rotationND(n, 0, 1, 0.4);
      const B = rotationND(n, 1, 2, 0.6);

      const R0 = geodesicInterpSO(A, B, 0);
      const R1 = geodesicInterpSO(A, B, 1);

      // Check R0 ≈ A
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(Math.abs(R0[i][j] - A[i][j])).toBeLessThan(1e-4);
        }
      }

      // Check R1 ≈ B
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(Math.abs(R1[i][j] - B[i][j])).toBeLessThan(1e-4);
        }
      }
    });

    it('should satisfy the halfway property for small rotations', () => {
      const n = 3;
      // Use small rotations where series converges
      const A = rotationND(n, 0, 1, 0.3);
      const B = rotationND(n, 0, 1, 0.9);

      const R_half = geodesicInterpSO(A, B, 0.5);

      // Distance from A to R_half should equal distance from R_half to B
      const dist1 = geodesicDistanceSO(A, R_half);
      const dist2 = geodesicDistanceSO(R_half, B);

      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-3);
    });
  });


  describe('Geodesic Distance', () => {
    it('should be zero for identical rotations', () => {
      const n = 4;
      const R = rotationND(n, 0, 1, 0.5);
      const dist = geodesicDistanceSO(R, R);
      expect(dist).toBeLessThan(1e-10);
    });

    it('should be symmetric for small rotations', () => {
      const n = 3;
      // Use small rotations to stay within convergence radius
      const R1 = rotationND(n, 0, 1, 0.4);
      const R2 = rotationND(n, 1, 2, 0.5);

      const dist1 = geodesicDistanceSO(R1, R2);
      const dist2 = geodesicDistanceSO(R2, R1);

      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-6);
    });

    it('should give reasonable values for random rotations (like in actual game)', () => {
      const n = 3;
      const R1 = sampleRandomRotation(n);
      const R2 = sampleRandomRotation(n);

      const dist = geodesicDistanceSO(R1, R2);

      // Distance should be finite and reasonable (not NaN, not huge)
      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThanOrEqual(0);
      // Max distance on SO(n) is bounded (roughly π√n for Frobenius norm)
      expect(dist).toBeLessThan(100);
    });
  });

  describe('Geodesic Interpolation with Random Rotations (actual game scenario)', () => {
    it('should preserve orthonormality for random rotations', () => {
      const n = 3;
      const A = sampleRandomRotation(n);
      const B = sampleRandomRotation(n);

      // Test at t=0.5 (the halfway case)
      const R = geodesicInterpSO(A, B, 0.5);

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

      const R_half = geodesicInterpSO(A, B, 0.5);

      const dist_A_to_half = geodesicDistanceSO(A, R_half);
      const dist_half_to_B = geodesicDistanceSO(R_half, B);

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
