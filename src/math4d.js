/**
 * 4D Mathematics for Euclidean R^4 Navigation
 * Implements vector operations and 4D rotations
 */

// Create a 4D vector
export function vec4(x = 0, y = 0, z = 0, w = 0) {
  return [x, y, z, w];
}

// Add two 4D vectors
export function add4(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

// Subtract two 4D vectors
export function sub4(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
}

// Scale a 4D vector
export function scale4(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s, v[3] * s];
}

// Dot product
export function dot4(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// Length of 4D vector
export function length4(v) {
  return Math.sqrt(dot4(v, v));
}

// Normalize 4D vector
export function normalize4(v) {
  const len = length4(v);
  return len > 0 ? scale4(v, 1 / len) : vec4(1, 0, 0, 0);
}

// Euclidean distance in R^4
export function distance4(a, b) {
  const diff = sub4(b, a);
  return length4(diff);
}

// Create identity 4x4 matrix
export function identity4x4() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

// Create rotation matrix in plane (i, j) by angle theta
// i and j are 0-indexed dimension indices
export function rotation4D(i, j, theta) {
  const mat = identity4x4();
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  mat[i][i] = c;
  mat[i][j] = -s;
  mat[j][i] = s;
  mat[j][j] = c;

  return mat;
}

// Multiply 4x4 matrix by 4D vector
export function matVecMult(mat, v) {
  return [
    mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2] + mat[0][3] * v[3],
    mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2] + mat[1][3] * v[3],
    mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2] + mat[2][3] * v[3],
    mat[3][0] * v[0] + mat[3][1] * v[1] + mat[3][2] * v[2] + mat[3][3] * v[3]
  ];
}

// Multiply two 4x4 matrices
export function matMult(a, b) {
  const result = identity4x4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = 0;
      for (let k = 0; k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

// Transpose matrix (useful for inverse of rotation)
export function transpose(mat) {
  const result = identity4x4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = mat[j][i];
    }
  }
  return result;
}

// Random 4D vector in [0, 1]^4
export function randomVec4() {
  return [Math.random(), Math.random(), Math.random(), Math.random()];
}

// Random unit 4D vector
export function randomUnitVec4() {
  // Generate using normal distribution for uniform sphere
  const v = [
    gaussianRandom(),
    gaussianRandom(),
    gaussianRandom(),
    gaussianRandom()
  ];
  return normalize4(v);
}

// Gaussian random number (Box-Muller transform)
function gaussianRandom() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Lerp for smooth animation
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Lerp for matrices (used in rotation animation)
export function lerpMatrix(a, b, t) {
  const result = identity4x4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = lerp(a[i][j], b[i][j], t);
    }
  }
  return result;
}
