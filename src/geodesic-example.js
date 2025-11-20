/**
 * Example usage of geodesic distance and derivative functions
 * 
 * This demonstrates how to compute:
 * 1. Geodesic distance between rotation matrices
 * 2. Derivatives of geodesic distance with respect to swivel parameters
 */

import {
  geodesicDistanceArray,
  dGeodesicAtZeroArray,
  identityNxN,
  rotationND
} from './math4d.js';

console.log('=== Geodesic Distance Examples ===\n');

// Example 1: Distance between identity and a simple rotation
console.log('Example 1: 2D rotation by π/4');
const I2 = identityNxN(2);
const R2_45 = rotationND(2, 0, 1, Math.PI / 4);
const dist1 = geodesicDistanceArray(I2, R2_45);
console.log('  Geodesic distance:', dist1.toFixed(4));
console.log('  Expected (≈ √2 * π/4):', (Math.sqrt(2) * Math.PI / 4).toFixed(4));
console.log();

// Example 2: Distance between two different rotations
console.log('Example 2: Two 3D rotations');
const R3_1 = rotationND(3, 0, 1, Math.PI / 3);
const R3_2 = rotationND(3, 1, 2, Math.PI / 6);
const dist2 = geodesicDistanceArray(R3_1, R3_2);
console.log('  Geodesic distance:', dist2.toFixed(4));
console.log();

// Example 3: Derivative computation
console.log('Example 3: Derivative of distance');
const R = identityNxN(3);
const T = rotationND(3, 0, 1, 0.5);

// Generator K for rotation in plane (0,1)
// This is a skew-symmetric matrix
const K = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 0]
];

const deriv = dGeodesicAtZeroArray(R, T, K);
console.log('  Base rotation: Identity');
console.log('  Target rotation: 0.5 rad in plane (0,1)');
console.log('  Swivel direction: plane (0,1)');
console.log('  Derivative:', deriv.toFixed(6));
console.log();

// Example 4: Derivatives in different directions
console.log('Example 4: Derivatives for different swivel directions');
const K01 = [[0, -1, 0], [1, 0, 0], [0, 0, 0]];
const K02 = [[0, 0, -1], [0, 0, 0], [1, 0, 0]];
const K12 = [[0, 0, 0], [0, 0, -1], [0, 1, 0]];

const deriv01 = dGeodesicAtZeroArray(R, T, K01);
const deriv02 = dGeodesicAtZeroArray(R, T, K02);
const deriv12 = dGeodesicAtZeroArray(R, T, K12);

console.log('  Derivative in plane (0,1):', deriv01.toFixed(6));
console.log('  Derivative in plane (0,2):', deriv02.toFixed(6));
console.log('  Derivative in plane (1,2):', deriv12.toFixed(6));
console.log();

// Example 5: Distance is zero when matrices are identical
console.log('Example 5: Distance between identical matrices');
const R_same = rotationND(4, 0, 2, 0.7);
const dist_zero = geodesicDistanceArray(R_same, R_same);
console.log('  Geodesic distance:', dist_zero.toFixed(10));
console.log('  (Should be very close to 0)');
console.log();

console.log('=== Examples Complete ===');
