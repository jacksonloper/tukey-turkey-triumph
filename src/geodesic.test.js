/**
 * Tests for geodesic distance calculations
 */

import { describe, it, expect } from 'vitest';
import {
  geodesicDistance,
  geodesicDistanceArray,
  dGeodesicAtZero,
  dGeodesicAtZeroArray,
  arrayToMathMatrix,
  logUnitary,
  frobeniusNorm
} from './geodesic.js';
import { identityNxN, rotationND } from './math4d.js';
import { sampleRandomRotation } from './sphere-path.js';
import * as math from 'mathjs';

describe('Geodesic Distance Functions', () => {
  describe('logUnitary', () => {
    it('should compute log of identity as zero matrix', () => {
      const I = math.matrix(identityNxN(2));
      const logI = logUnitary(I);
      const norm = frobeniusNorm(logI);
      
      // log(I) should be the zero matrix
      expect(norm).toBeLessThan(1e-10);
    });

    it('should handle 2D rotation matrices', () => {
      // Create a 90-degree rotation
      const theta = Math.PI / 2;
      const R = math.matrix(rotationND(2, 0, 1, theta));
      
      const logR = logUnitary(R);
      
      // All elements should be finite
      expect(logR.get([0, 0])).not.toBeNaN();
      expect(logR.get([0, 1])).not.toBeNaN();
      expect(logR.get([1, 0])).not.toBeNaN();
      expect(logR.get([1, 1])).not.toBeNaN();
    });

    it('should handle 3D rotation matrices', () => {
      const R = math.matrix(sampleRandomRotation(3));
      const logR = logUnitary(R);
      
      // Should produce a finite result
      const norm = frobeniusNorm(logR);
      expect(isFinite(norm)).toBe(true);
    });
  });

  describe('geodesicDistance', () => {
    it('should be zero for identical rotations', () => {
      const R = arrayToMathMatrix(rotationND(3, 0, 1, 0.5));
      const dist = geodesicDistance(R, R);
      
      expect(dist).toBeLessThan(1e-10);
    });

    it('should be zero for identity matrices', () => {
      const I = arrayToMathMatrix(identityNxN(3));
      const dist = geodesicDistance(I, I);
      
      expect(dist).toBeLessThan(1e-10);
    });

    it('should be finite for different rotations', () => {
      const R1 = arrayToMathMatrix(sampleRandomRotation(3));
      const R2 = arrayToMathMatrix(sampleRandomRotation(3));
      const dist = geodesicDistance(R1, R2);
      
      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThanOrEqual(0);
    });

    it('should be symmetric', () => {
      const R1 = arrayToMathMatrix(sampleRandomRotation(3));
      const R2 = arrayToMathMatrix(sampleRandomRotation(3));
      
      const dist1 = geodesicDistance(R1, R2);
      const dist2 = geodesicDistance(R2, R1);
      
      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-8);
    });

    it('should give expected result for simple 2D rotation', () => {
      // Identity and 90-degree rotation
      const I = arrayToMathMatrix(identityNxN(2));
      const R = arrayToMathMatrix(rotationND(2, 0, 1, Math.PI / 2));
      
      const dist = geodesicDistance(I, R);
      
      // For a 2D rotation by angle theta, geodesic distance is sqrt(2) * |theta|
      // For theta = pi/2, expect distance close to sqrt(2) * pi/2 ≈ 2.22
      const expected = Math.sqrt(2) * Math.PI / 2;
      expect(dist).toBeGreaterThan(expected * 0.99);
      expect(dist).toBeLessThan(expected * 1.01);
    });
  });

  describe('geodesicDistanceArray', () => {
    it('should work with native arrays', () => {
      const R1 = identityNxN(3);
      const R2 = rotationND(3, 0, 1, Math.PI / 4);
      
      const dist = geodesicDistanceArray(R1, R2);
      
      expect(isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThanOrEqual(0);
    });

    it('should match mathjs version', () => {
      const R1_array = sampleRandomRotation(3);
      const R2_array = sampleRandomRotation(3);
      
      const R1_math = arrayToMathMatrix(R1_array);
      const R2_math = arrayToMathMatrix(R2_array);
      
      const dist1 = geodesicDistanceArray(R1_array, R2_array);
      const dist2 = geodesicDistance(R1_math, R2_math);
      
      expect(Math.abs(dist1 - dist2)).toBeLessThan(1e-10);
    });
  });

  describe('dGeodesicAtZero', () => {
    it('should compute derivative for identity case', () => {
      const I = arrayToMathMatrix(identityNxN(2));
      const R = arrayToMathMatrix(rotationND(2, 0, 1, 0.3));
      
      // Generator for rotation in plane (0,1)
      const K = math.matrix([[0, -1], [1, 0]]);
      
      const deriv = dGeodesicAtZero(I, R, K);
      
      expect(isFinite(deriv)).toBe(true);
    });

    it('should be zero when at target', () => {
      const R = arrayToMathMatrix(rotationND(3, 0, 1, 0.5));
      const K = math.matrix([
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 0]
      ]);
      
      // When R = T, derivative should be zero (we're at minimum)
      const deriv = dGeodesicAtZero(R, R, K);
      
      expect(Math.abs(deriv)).toBeLessThan(1e-6);
    });

    it('should give consistent results with different step sizes', () => {
      const R1 = arrayToMathMatrix(sampleRandomRotation(3));
      const R2 = arrayToMathMatrix(sampleRandomRotation(3));
      const K = math.matrix([
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 0]
      ]);
      
      const deriv1 = dGeodesicAtZero(R1, R2, K, 1e-5);
      const deriv2 = dGeodesicAtZero(R1, R2, K, 1e-6);
      const deriv3 = dGeodesicAtZero(R1, R2, K, 1e-7);
      
      // All should be finite
      expect(isFinite(deriv1)).toBe(true);
      expect(isFinite(deriv2)).toBe(true);
      expect(isFinite(deriv3)).toBe(true);
      
      // Should be roughly similar (within 10% for numerical derivatives)
      const avg = (deriv1 + deriv2 + deriv3) / 3;
      if (Math.abs(avg) > 1e-6) {
        expect(Math.abs(deriv1 - avg) / Math.abs(avg)).toBeLessThan(0.1);
        expect(Math.abs(deriv2 - avg) / Math.abs(avg)).toBeLessThan(0.1);
        expect(Math.abs(deriv3 - avg) / Math.abs(avg)).toBeLessThan(0.1);
      }
    });

    it('should work with different swivel directions', () => {
      const R1 = arrayToMathMatrix(identityNxN(3));
      const R2 = arrayToMathMatrix(rotationND(3, 1, 2, 0.4));
      
      // Different generators for different planes
      const K01 = math.matrix([[0, -1, 0], [1, 0, 0], [0, 0, 0]]);
      const K02 = math.matrix([[0, 0, -1], [0, 0, 0], [1, 0, 0]]);
      const K12 = math.matrix([[0, 0, 0], [0, 0, -1], [0, 1, 0]]);
      
      const deriv01 = dGeodesicAtZero(R1, R2, K01);
      const deriv02 = dGeodesicAtZero(R1, R2, K02);
      const deriv12 = dGeodesicAtZero(R1, R2, K12);
      
      expect(isFinite(deriv01)).toBe(true);
      expect(isFinite(deriv02)).toBe(true);
      expect(isFinite(deriv12)).toBe(true);
      
      // Since R2 rotates in plane (1,2), derivative for K12 should be non-zero
      // while derivatives for K01 and K02 might be different
      expect(Math.abs(deriv12)).toBeGreaterThan(1e-6);
    });
  });

  describe('dGeodesicAtZeroArray', () => {
    it('should work with native arrays', () => {
      const R1 = identityNxN(2);
      const R2 = rotationND(2, 0, 1, 0.3);
      const K = [[0, -1], [1, 0]];
      
      const deriv = dGeodesicAtZeroArray(R1, R2, K);
      
      expect(isFinite(deriv)).toBe(true);
    });

    it('should match mathjs version', () => {
      const R1_array = identityNxN(3);
      const R2_array = rotationND(3, 0, 1, 0.5);
      const K_array = [[0, -1, 0], [1, 0, 0], [0, 0, 0]];
      
      const R1_math = arrayToMathMatrix(R1_array);
      const R2_math = arrayToMathMatrix(R2_array);
      const K_math = math.matrix(K_array);
      
      const deriv1 = dGeodesicAtZeroArray(R1_array, R2_array, K_array);
      const deriv2 = dGeodesicAtZero(R1_math, R2_math, K_math);
      
      expect(Math.abs(deriv1 - deriv2)).toBeLessThan(1e-8);
    });
  });

  describe('Geodesic vs Non-Geodesic Distance Comparison', () => {
    it('should differ from Frobenius-based distance', () => {
      const R1 = arrayToMathMatrix(identityNxN(3));
      const R2 = arrayToMathMatrix(rotationND(3, 0, 1, Math.PI / 4));
      
      // Geodesic distance
      const geodesicDist = geodesicDistance(R1, R2);
      
      // Simple Frobenius distance (not geodesic)
      const R1_arr = identityNxN(3);
      const R2_arr = rotationND(3, 0, 1, Math.PI / 4);
      let frobDist = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          frobDist += Math.pow(R2_arr[i][j] - R1_arr[i][j], 2);
        }
      }
      frobDist = Math.sqrt(frobDist);
      
      // They should be different
      expect(Math.abs(geodesicDist - frobDist)).toBeGreaterThan(0.01);
    });
  });
});
