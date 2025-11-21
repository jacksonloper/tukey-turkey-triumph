# Geodesic Distance on SO(n) - Mathematical Background

This document explains the mathematical approach used in the geodesic distance implementation.

## Overview

The Special Orthogonal group SO(n) is the group of n×n orthogonal matrices with determinant +1. These represent rotations in n-dimensional space. Computing distances between rotations requires understanding the Riemannian geometry of SO(n).

## Geodesic Distance

The **geodesic distance** between two rotation matrices R and T is the length of the shortest path connecting them on the manifold SO(n).

### Formula

The geodesic distance is computed as:

```
d(R, T) = ||log(R^* T)||_F
```

where:
- `R^*` is the conjugate transpose of R (for real matrices, this is just the transpose R^T)
- `log` is the matrix logarithm
- `||·||_F` is the Frobenius norm

### Why This Works

1. **Relative Rotation**: `R^* T` gives the rotation that takes R to T
2. **Logarithm**: The matrix logarithm maps rotations to their generators (elements of the Lie algebra so(n))
3. **Frobenius Norm**: Measures the "size" of the generator, which corresponds to the rotation angle

## Matrix Logarithm for Unitary Matrices

The matrix logarithm is computed using the **inverse scaling and squaring method** with Taylor series expansion, as implemented in the mathjs fork.

### Algorithm Overview

1. **Square Root Iterations**: The matrix is repeatedly square-rooted until it is close to the identity matrix
2. **Taylor Series**: Once ||A - I|| < 0.5, use the Taylor series:
   ```
   log(I + X) ≈ Σ_{k=1}^∞ (-1)^{k+1} X^k / k
   ```
3. **Scaling Back**: The result is multiplied by 2^m, where m is the number of square roots taken

This approach is based on:
- "Functions of Matrices: Theory and Computation" by N. J. Higham (2008)
- scipy.linalg.logm implementation

### Advantages

- More numerically stable than eigendecomposition for ill-conditioned matrices
- Handles a wider range of matrix types
- Better accuracy for matrices far from identity

### Special Cases

- **Identity Matrix**: log(I) = 0 (zero matrix)
- **Small Rotations**: For rotations close to identity, fewer iterations are needed

## Derivatives with Respect to Swivel Parameters

The derivative of the geodesic distance with respect to a swivel parameter ε is:

```
d/dε [d(H(ε), T)]_{ε=0}
```

where `H(ε) = R exp(ε K)` is a one-parameter family of rotations.

### Numerical Differentiation

We use **central finite differences** for numerical stability:

```
d/dε [d(H(ε), T)]_{ε=0} ≈ [d(H(h), T) - d(H(-h), T)] / (2h)
```

with default step size h = 10^{-6}.

### Generator Matrix K

The generator K is a **skew-symmetric matrix** representing the infinitesimal rotation direction. For a rotation in plane (i, j):

```
K_{ij} = -1
K_{ji} = +1
K_{kl} = 0  for all other entries
```

## Comparison with Non-Geodesic Distance

The original implementation used:

```
d_Frob(R, Q) = ||R^T Q - I||_F
```

This is simpler but **not** a true geodesic distance. Key differences:

| Property | Geodesic Distance | Frobenius Distance |
|----------|------------------|-------------------|
| Intrinsic to manifold | ✓ Yes | ✗ No |
| Shortest path length | ✓ Yes | ✗ No |
| Relationship to angle | Direct | Indirect |

### Example: 2D Rotations

For a 2D rotation by angle θ:
- Geodesic distance: `√2 · |θ|`
- Frobenius distance: Different, non-linear relationship

## Usage Examples

See `src/geodesic-example.js` for complete working examples.

### Basic Distance Calculation

```javascript
import { geodesicDistanceArray } from './math4d.js';

const R1 = identityNxN(3);
const R2 = rotationND(3, 0, 1, Math.PI / 4);
const dist = geodesicDistanceArray(R1, R2);
```

### Derivative Calculation

```javascript
import { dGeodesicAtZeroArray } from './math4d.js';

const R = identityNxN(3);
const T = rotationND(3, 0, 1, 0.5);
const K = [[0, -1, 0], [1, 0, 0], [0, 0, 0]];  // Generator for plane (0,1)

const derivative = dGeodesicAtZeroArray(R, T, K);
```

## References

1. **"Functions of Matrices: Theory and Computation"** by N. J. Higham (2008) - Mathematical foundation for matrix logarithm
2. **scipy.linalg.logm** - Reference implementation using inverse scaling and squaring
3. **Matrix Lie Groups and Lie Algebras**: The connection between SO(n) and so(n) via the exponential map
4. **Riemannian Geometry**: Geodesic distances on matrix manifolds

## Implementation Notes

- Uses **mathjs fork** with built-in `logm` function implementing inverse scaling and squaring method
- Much simpler and more robust than custom eigendecomposition approach
- Better numerical stability for a wider range of matrices
- Optimized for real orthogonal matrices (common case)

## Limitations

- For very large matrices (n > 10), performance may degrade
- Assumes proper rotation matrices (orthogonal with det = +1)
- The inverse scaling and squaring method may require many iterations for matrices far from identity
