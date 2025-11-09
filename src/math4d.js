/**
 * N-D Mathematics for Euclidean R^N Navigation
 * Implements vector operations and N-D rotations
 */

// Create an N-dimensional vector
export function vecN(dim, ...values) {
  const result = new Array(dim).fill(0);
  for (let i = 0; i < Math.min(dim, values.length); i++) {
    result[i] = values[i];
  }
  return result;
}

// Create a 4D vector (backward compatibility)
export function vec4(x = 0, y = 0, z = 0, w = 0) {
  return [x, y, z, w];
}

// Add two N-dimensional vectors
export function addN(a, b) {
  return a.map((v, i) => v + b[i]);
}

// Subtract two N-dimensional vectors
export function subN(a, b) {
  return a.map((v, i) => v - b[i]);
}

// Scale an N-dimensional vector
export function scaleN(v, s) {
  return v.map(val => val * s);
}

// Dot product for N-dimensional vectors
export function dotN(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

// Length of N-dimensional vector
export function lengthN(v) {
  return Math.sqrt(dotN(v, v));
}

// Normalize N-dimensional vector
export function normalizeN(v) {
  const len = lengthN(v);
  if (len > 0) {
    return scaleN(v, 1 / len);
  }
  const result = new Array(v.length).fill(0);
  result[0] = 1;
  return result;
}

// Euclidean distance in R^N
export function distanceN(a, b) {
  const diff = subN(b, a);
  return lengthN(diff);
}

// Add two 4D vectors (backward compatibility)
export function add4(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

// Subtract two 4D vectors (backward compatibility)
export function sub4(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
}

// Scale a 4D vector (backward compatibility)
export function scale4(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s, v[3] * s];
}

// Dot product (backward compatibility)
export function dot4(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// Length of 4D vector (backward compatibility)
export function length4(v) {
  return Math.sqrt(dot4(v, v));
}

// Normalize 4D vector (backward compatibility)
export function normalize4(v) {
  const len = length4(v);
  return len > 0 ? scale4(v, 1 / len) : vec4(1, 0, 0, 0);
}

// Euclidean distance in R^4 (backward compatibility)
export function distance4(a, b) {
  const diff = sub4(b, a);
  return length4(diff);
}

// Create identity NxN matrix
export function identityNxN(n) {
  const mat = [];
  for (let i = 0; i < n; i++) {
    mat[i] = new Array(n).fill(0);
    mat[i][i] = 1;
  }
  return mat;
}

// Create rotation matrix in plane (i, j) by angle theta for N dimensions
// i and j are 0-indexed dimension indices
export function rotationND(n, i, j, theta) {
  const mat = identityNxN(n);
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  mat[i][i] = c;
  mat[i][j] = -s;
  mat[j][i] = s;
  mat[j][j] = c;

  return mat;
}

// Multiply NxN matrix by N-dimensional vector
export function matVecMultN(mat, v) {
  const n = v.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += mat[i][j] * v[j];
    }
  }
  return result;
}

// Multiply two NxN matrices
export function matMultN(a, b) {
  const n = a.length;
  const result = identityNxN(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = 0;
      for (let k = 0; k < n; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

// Transpose NxN matrix (useful for inverse of rotation)
export function transposeN(mat) {
  const n = mat.length;
  const result = identityNxN(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = mat[j][i];
    }
  }
  return result;
}

// Create identity 4x4 matrix (backward compatibility)
export function identity4x4() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

// Create rotation matrix in plane (i, j) by angle theta (backward compatibility)
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

// Multiply 4x4 matrix by 4D vector (backward compatibility)
export function matVecMult(mat, v) {
  return [
    mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2] + mat[0][3] * v[3],
    mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2] + mat[1][3] * v[3],
    mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2] + mat[2][3] * v[3],
    mat[3][0] * v[0] + mat[3][1] * v[1] + mat[3][2] * v[2] + mat[3][3] * v[3]
  ];
}

// Multiply two 4x4 matrices (backward compatibility)
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

// Transpose matrix (useful for inverse of rotation - backward compatibility)
export function transpose(mat) {
  const result = identity4x4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = mat[j][i];
    }
  }
  return result;
}

// Random N-dimensional vector in [0, 1]^N
export function randomVecN(n) {
  return Array.from({ length: n }, () => Math.random());
}

// Random unit N-dimensional vector
export function randomUnitVecN(n) {
  // Generate using normal distribution for uniform sphere
  const v = Array.from({ length: n }, () => gaussianRandom());
  return normalizeN(v);
}

// Random 4D vector in [0, 1]^4 (backward compatibility)
export function randomVec4() {
  return [Math.random(), Math.random(), Math.random(), Math.random()];
}

// Random unit 4D vector (backward compatibility)
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

// Lerp for NxN matrices (used in rotation animation)
export function lerpMatrixN(a, b, t) {
  const n = a.length;
  const result = identityNxN(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = lerp(a[i][j], b[i][j], t);
    }
  }
  return result;
}

// Lerp for matrices (used in rotation animation - backward compatibility)
export function lerpMatrix(a, b, t) {
  const result = identity4x4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = lerp(a[i][j], b[i][j], t);
    }
  }
  return result;
}

/**
 * Matrix subtraction for NxN matrices
 */
export function matSubtractN(a, b) {
  const n = a.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = a[i][j] - b[i][j];
    }
  }
  return result;
}

/**
 * Matrix addition for NxN matrices
 */
export function matAddN(a, b) {
  const n = a.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = a[i][j] + b[i][j];
    }
  }
  return result;
}

/**
 * Scale matrix by scalar
 */
export function matScaleN(mat, s) {
  const n = mat.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = mat[i][j] * s;
    }
  }
  return result;
}

/**
 * Frobenius norm of a matrix: sqrt(sum of squares of all elements)
 */
export function frobeniusNorm(mat) {
  let sum = 0;
  for (let i = 0; i < mat.length; i++) {
    for (let j = 0; j < mat[i].length; j++) {
      sum += mat[i][j] * mat[i][j];
    }
  }
  return Math.sqrt(sum);
}

/**
 * Matrix logarithm for rotation matrices in SO(n)
 * Uses truncated series expansion: log(M) = sum_{k=1}^N (-1)^(k+1) (M - I)^k / k
 * This converges for rotation matrices and gives a skew-symmetric result
 */
export function matrixLogN(mat, terms = 8) {
  const n = mat.length;
  const I = identityNxN(n);
  const A = matSubtractN(mat, I); // M - I

  // Compute powers of A and accumulate the series
  let result = matScaleN(A, 1); // First term: (M - I)
  let power = A; // Current power of A

  for (let k = 2; k <= terms; k++) {
    power = matMultN(power, A); // A^k
    const term = matScaleN(power, Math.pow(-1, k + 1) / k);
    result = matAddN(result, term);
  }

  return result;
}

/**
 * Geodesic distance on SO(n) between two rotation matrices
 * Computes ||log(R^T Q)||_F where ||·||_F is the Frobenius norm
 *
 * @param {Array} R - First rotation matrix (target rotation)
 * @param {Array} Q - Second rotation matrix (current rotation)
 * @returns {number} Geodesic distance (0 means aligned, increases with misalignment)
 */
export function geodesicDistanceSO(R, Q) {
  // Compute R^T
  const RT = transposeN(R);

  // Compute relative rotation: R^T Q
  const relativeRotation = matMultN(RT, Q);

  // Compute matrix logarithm
  const logMat = matrixLogN(relativeRotation);

  // Compute Frobenius norm
  return frobeniusNorm(logMat);
}

