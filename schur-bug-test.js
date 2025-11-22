/**
 * Test case demonstrating Schur decomposition bug in mathjs feat/logm branch
 *
 * Problem: math.schur() does not return a quasi-upper-triangular matrix for rotation matrices
 * Expected: Schur decomposition should produce T with T[i,j] ≈ 0 for i > j (or quasi-triangular)
 * Actual: T has large non-zero values below the diagonal
 */

import * as math from 'mathjs';

console.log('=== Schur Decomposition Bug Test ===\n');

// Example rotation matrix (from random QR decomposition)
const R = [
  [-0.03591206220229135, -0.09100469507870354, 0.9952027277203429],
  [-0.3802068171617618, -0.9197139315803332, -0.09782157349362577],
  [0.9242040358990549, -0.38189583596928406, -0.0015717815434243287]
];

console.log('Input rotation matrix R:');
console.log(R);

// Verify it's a valid rotation matrix
const M = math.matrix(R);
const det = math.det(M);
const MT = math.transpose(M);
const MTM = math.multiply(MT, M);

console.log('\nDeterminant:', det, '(should be ≈1)');
console.log('R^T * R (should be identity):');
console.log(MTM.toArray());

// Compute Schur decomposition
console.log('\n=== Computing Schur Decomposition ===');
const schurResult = math.schur(M);
const T = schurResult.T;
const U = schurResult.U;

console.log('\nSchur T matrix:');
console.log(T.toArray());

console.log('\nSchur U matrix:');
console.log(U.toArray());

// Check triangularity
console.log('\n=== Checking Triangularity ===');
const eps = 2.220446049250313e-16;
const tolerance = 100 * eps;
let isTriangular = true;
const n = T.size()[0];

console.log(`Tolerance for upper triangular: ${tolerance}`);
console.log('\nLower triangular elements (should all be ≈0):');

for (let i = 1; i < n; i++) {
  for (let j = 0; j < i; j++) {
    const val = T.get([i, j]);
    const absVal = Math.abs(val);
    const status = absVal <= tolerance ? '✓ OK' : '✗ FAIL';
    console.log(`  T[${i},${j}] = ${val.toFixed(16)} (|val| = ${absVal.toExponential(2)}) ${status}`);
    if (absVal > tolerance) {
      isTriangular = false;
    }
  }
}

console.log('\n=== Result ===');
if (isTriangular) {
  console.log('✓ Schur decomposition produced upper triangular matrix');
} else {
  console.log('✗ BUG: Schur decomposition did NOT produce upper triangular matrix!');
  console.log('   This causes logm to fail with "Matrix must be upper triangular"');
}

// Try to compute logm
console.log('\n=== Testing logm ===');
try {
  const logM = math.logm(M);
  console.log('✓ logm succeeded');
  console.log('Result:');
  console.log(logM.toArray());
} catch (error) {
  console.log('✗ logm failed with error:', error.message);
}
