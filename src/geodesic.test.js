/**
 * Tests for geodesic distance calculations
 * Uses WASM implementation (standard mathjs doesn't include logm)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  geodesicDistanceArray,
  dGeodesicAtZeroArray,
  geodesicInterpArray,
} from './geodesic.js';
import { initWasm } from './geodesic-wasm.js';
import { identityNxN, rotationND } from './math4d.js';
import { sampleRandomRotation } from './sphere-path.js';

describe('Geodesic Distance Functions (WASM)', () => {
  beforeAll(async () => {
    // Initialize WASM before tests (required since standard mathjs doesn't have logm)
    const initialized = await initWasm();
    if (!initialized) {
      throw new Error('WASM module failed to initialize - tests require WASM support');
    }
  });

  describe('geodesicDistanceArray', () => {
    it('should be zero for identical rotations', () => {
      const R = rotationND(3, 0, 1, 0.5);
      const dist = geodesicDistanceArray(R, R);

      expect(dist).toBeLessThan(1e-10);
    });

    it('should be zero for identity matrices', () => {
      const I = identityNxN(3);
      const dist = geodesicDistanceArray(I, I);

      expect(dist).toBeLessThan(1e-10);
    });

    it('should be finite for different rotations', () => {
      const R1 = sampleRandomRotation(3);
      const R2 = sampleRandomRotation(3);
      const dist = geodesicDistanceArray(R1, R2);

      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThanOrEqual(0);
    });

    it('should be symmetric', () => {
      const R1 = sampleRandomRotation(3);
      const R2 = sampleRandomRotation(3);

      const dist1 = geodesicDistanceArray(R1, R2);
      const dist2 = geodesicDistanceArray(R2, R1);

      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-10);
    });

    it('should give expected result for simple 2D rotation', () => {
      const I = identityNxN(2);
      const R90 = rotationND(2, 0, 1, Math.PI / 2); // 90 degree rotation

      const dist = geodesicDistanceArray(I, R90);

      // For a 90 degree 2D rotation, distance should be sqrt(2) * π/2 ≈ 2.22
      // (Frobenius norm of the log matrix)
      expect(dist).toBeGreaterThan(2.0);
      expect(dist).toBeLessThan(2.5);
    });

    it('should work with 2x2 matrices', () => {
      const R = rotationND(2, 0, 1, 0.5);
      const T = rotationND(2, 0, 1, 0.7);
      const dist = geodesicDistanceArray(R, T);

      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThan(0);
    });

    it('should work with 4x4 matrices', () => {
      const R = sampleRandomRotation(4);
      const T = sampleRandomRotation(4);
      const dist = geodesicDistanceArray(R, T);

      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe('dGeodesicAtZeroArray', () => {
    it('should compute derivative for identity case', () => {
      const I = identityNxN(2);
      const R = rotationND(2, 0, 1, 0.3);

      // Create a small perturbation direction
      const K = [
        [0, -1],
        [1, 0]
      ]; // Generator for 2D rotation

      const deriv = dGeodesicAtZeroArray(I, R, K);

      // Should give a finite result
      expect(isFinite(deriv)).toBe(true);
    });

    it('should be zero when at target', () => {
      const R = rotationND(2, 0, 1, 0.5);
      const K = [
        [0, -1],
        [1, 0]
      ];

      const deriv = dGeodesicAtZeroArray(R, R, K);

      // At the target, the derivative should be near zero
      expect(Math.abs(deriv)).toBeLessThan(1e-6);
    });

    it('should give consistent results with different step sizes', () => {
      const R = identityNxN(2);
      const T = rotationND(2, 0, 1, 0.5);
      const K = [
        [0, -1],
        [1, 0]
      ];

      const deriv1 = dGeodesicAtZeroArray(R, T, K, 1e-5);
      const deriv2 = dGeodesicAtZeroArray(R, T, K, 1e-6);

      // Results should be similar for different step sizes
      expect(Math.abs(deriv1 - deriv2)).toBeLessThan(0.01);
    });

    it('should work with different swivel directions', () => {
      const R = identityNxN(2);
      const T = rotationND(2, 0, 1, 0.5);

      const K1 = [
        [0, -1],
        [1, 0]
      ];

      const K2 = [
        [0, -0.5],
        [0.5, 0]
      ];

      const deriv1 = dGeodesicAtZeroArray(R, T, K1);
      const deriv2 = dGeodesicAtZeroArray(R, T, K2);

      // Both should give finite results
      expect(isFinite(deriv1)).toBe(true);
      expect(isFinite(deriv2)).toBe(true);
    });
  });

  describe('Geodesic Interpolation', () => {
    it('should interpolate at t=0 to start rotation', () => {
      const A = sampleRandomRotation(3);
      const B = sampleRandomRotation(3);

      const result = geodesicInterpArray(A, B, 0);

      // At t=0, should equal A
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(Math.abs(result[i][j] - A[i][j])).toBeLessThan(1e-10);
        }
      }
    });

    it('should interpolate at t=1 to end rotation', () => {
      const A = sampleRandomRotation(3);
      const B = sampleRandomRotation(3);

      const result = geodesicInterpArray(A, B, 1);

      // At t=1, should equal B (with numerical tolerance)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(Math.abs(result[i][j] - B[i][j])).toBeLessThan(1e-6);
        }
      }
    });

    it('should give halfway point at t=0.5 along geodesic', () => {
      const I = identityNxN(2);
      const R90 = rotationND(2, 0, 1, Math.PI / 2);

      const halfway = geodesicInterpArray(I, R90, 0.5);

      // Distance from I to halfway should be half the total distance
      const totalDist = geodesicDistanceArray(I, R90);
      const halfDist = geodesicDistanceArray(I, halfway);

      expect(Math.abs(halfDist - totalDist / 2)).toBeLessThan(0.01);
    });

    it('should produce valid rotation matrices', () => {
      const A = sampleRandomRotation(3);
      const B = sampleRandomRotation(3);

      const result = geodesicInterpArray(A, B, 0.5);

      // Check orthogonality: R^T * R should be identity
      let orthoError = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) {
            sum += result[k][i] * result[k][j];
          }
          const expected = (i === j) ? 1 : 0;
          orthoError += Math.abs(sum - expected);
        }
      }

      expect(orthoError).toBeLessThan(1e-6);
    });
  });

  describe('Geodesic vs Non-Geodesic Distance Comparison', () => {
    it('should differ from Frobenius-based distance', () => {
      const R1 = rotationND(3, 0, 1, 0.5);
      const R2 = rotationND(3, 1, 2, 0.7);

      const geodesicDist = geodesicDistanceArray(R1, R2);

      // Frobenius distance: ||R1 - R2||_F
      let frobeniusDist = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const diff = R1[i][j] - R2[i][j];
          frobeniusDist += diff * diff;
        }
      }
      frobeniusDist = Math.sqrt(frobeniusDist);

      // Geodesic distance should be different from Frobenius distance
      // (they're different metrics on SO(n))
      expect(Math.abs(geodesicDist - frobeniusDist)).toBeGreaterThan(0.01);
    });
  });

  describe('Edge cases', () => {
    it('should handle small rotations', () => {
      const I = identityNxN(2);
      const RSmall = rotationND(2, 0, 1, 0.001); // Very small rotation

      const dist = geodesicDistanceArray(I, RSmall);

      // For small angles, geodesic distance ≈ angle (with some tolerance)
      expect(Math.abs(dist - 0.001)).toBeLessThan(0.001);
    });

    it('should handle large dimension matrices', () => {
      const R1 = sampleRandomRotation(10);
      const R2 = sampleRandomRotation(10);

      const dist = geodesicDistanceArray(R1, R2);

      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThan(0);
    });

    it('should handle interpolation with identical matrices', () => {
      const R = sampleRandomRotation(3);

      const result = geodesicInterpArray(R, R, 0.5);

      // Interpolating between identical matrices should give the same matrix
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(Math.abs(result[i][j] - R[i][j])).toBeLessThan(1e-10);
        }
      }
    });
  });
});
