/**
 * Tests for WASM-accelerated geodesic functions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  initWasm, 
  geodesicDistanceWasm, 
  geodesicDistanceWasmEigen,
  geodesicInterpWasm, 
  geodesicInterpWasmEigen,
  isWasmAvailable 
} from './geodesic-wasm.js';
import { geodesicDistanceArray, geodesicInterpArray } from './geodesic.js';

describe('WASM Geodesic Functions', () => {
  beforeAll(async () => {
    // Try to initialize WASM
    const initialized = await initWasm();
    if (!initialized) {
      console.warn('WASM initialization failed, tests will be skipped');
    }
  });

  it('should initialize WASM module', async () => {
    const available = isWasmAvailable();
    expect(available).toBe(true);
  });

  describe('geodesicDistanceWasm', () => {
    it('should compute geodesic distance for 2x2 rotation matrices', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      // Identity matrix
      const I = [
        [1, 0],
        [0, 1],
      ];

      // 90 degree rotation
      const R90 = [
        [0, -1],
        [1, 0],
      ];

      // Distance from identity to R90 should be close to pi/2
      const distWasm = geodesicDistanceWasm(I, R90);
      const distMathjs = geodesicDistanceArray(I, R90);

      console.log('WASM distance:', distWasm);
      console.log('MathJS distance:', distMathjs);

      // Allow some numerical tolerance
      expect(Math.abs(distWasm - distMathjs)).toBeLessThan(0.01);
    });

    it('should compute zero distance for identical matrices', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const distWasm = geodesicDistanceWasm(I, I);
      expect(distWasm).toBeLessThan(1e-10);
    });
  });

  describe('geodesicInterpWasm', () => {
    it('should interpolate between two rotation matrices', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      // Identity matrix
      const I = [
        [1, 0],
        [0, 1],
      ];

      // 90 degree rotation
      const R90 = [
        [0, -1],
        [1, 0],
      ];

      // Interpolate at t=0.5 (midpoint)
      const resultWasm = geodesicInterpWasm(I, R90, 0.5);
      const resultMathjs = geodesicInterpArray(I, R90, 0.5);

      console.log('WASM interp:', resultWasm);
      console.log('MathJS interp:', resultMathjs);

      // Compare element-wise
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(Math.abs(resultWasm[i][j] - resultMathjs[i][j])).toBeLessThan(0.01);
        }
      }
    });

    it('should return start matrix at t=0', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      const A = [
        [1, 0],
        [0, 1],
      ];

      const B = [
        [0, -1],
        [1, 0],
      ];

      const result = geodesicInterpWasm(A, B, 0);

      // Should be approximately equal to A
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(Math.abs(result[i][j] - A[i][j])).toBeLessThan(1e-10);
        }
      }
    });

    it('should return end matrix at t=1', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      const A = [
        [1, 0],
        [0, 1],
      ];

      const B = [
        [0, -1],
        [1, 0],
      ];

      const result = geodesicInterpWasm(A, B, 1);

      // Should be approximately equal to B (relaxed tolerance for numerical precision)
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(Math.abs(result[i][j] - B[i][j])).toBeLessThan(1e-7);
        }
      }
    });
  });

  describe('Eigendecomposition-based methods', () => {
    it('geodesicDistanceWasmEigen should match standard method', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      // Identity matrix
      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      // 60 degree rotation around z-axis
      const cos60 = Math.cos(Math.PI / 3);
      const sin60 = Math.sin(Math.PI / 3);
      const R60 = [
        [cos60, -sin60, 0],
        [sin60, cos60, 0],
        [0, 0, 1],
      ];

      const distStandard = geodesicDistanceWasm(I, R60);
      const distEigen = geodesicDistanceWasmEigen(I, R60);

      console.log('Standard distance:', distStandard);
      console.log('Eigen distance:', distEigen);

      // Both methods should give similar results
      expect(Math.abs(distStandard - distEigen)).toBeLessThan(0.01);
    });

    it('geodesicInterpWasmEigen should match standard method', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      // Identity matrix
      const I = [
        [1, 0],
        [0, 1],
      ];

      // 90 degree rotation
      const R90 = [
        [0, -1],
        [1, 0],
      ];

      // Interpolate at t=0.5 (midpoint)
      const resultStandard = geodesicInterpWasm(I, R90, 0.5);
      const resultEigen = geodesicInterpWasmEigen(I, R90, 0.5);

      console.log('Standard interp:', resultStandard);
      console.log('Eigen interp:', resultEigen);

      // Compare element-wise
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(Math.abs(resultStandard[i][j] - resultEigen[i][j])).toBeLessThan(0.01);
        }
      }
    });

    it('geodesicDistanceWasmEigen should return zero for identical matrices', () => {
      if (!isWasmAvailable()) {
        console.warn('Skipping test: WASM not available');
        return;
      }

      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const distEigen = geodesicDistanceWasmEigen(I, I);
      expect(distEigen).toBeLessThan(1e-10);
    });
  });
});
