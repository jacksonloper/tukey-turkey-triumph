# WASM Matrix Logarithm Module

This module provides high-performance matrix logarithm and related functions using Rust and nalgebra, compiled to WebAssembly.

## Features

- `matrix_logm`: Matrix logarithm for orthogonal/unitary matrices (using scaling and squaring method)
- `matrix_logm_eigen`: Matrix logarithm using eigendecomposition via Schur decomposition
- `matrix_expm`: Matrix exponential
- `geodesic_distance`: Geodesic distance between rotation matrices on SO(n)
- `geodesic_distance_eigen`: Geodesic distance using eigendecomposition approach
- `geodesic_interp`: Geodesic interpolation between rotation matrices
- `geodesic_interp_eigen`: Geodesic interpolation using eigendecomposition approach

## Building

### Prerequisites

1. Install Rust and cargo (if not already installed):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install wasm-pack:
```bash
cargo install wasm-pack
```

### Build the WASM module

```bash
cd wasm-logm
wasm-pack build --target web --release
```

This will create a `pkg` directory with the compiled WASM module and JavaScript bindings.

## Usage

```javascript
import init, { matrix_logm, matrix_logm_eigen, geodesic_distance, geodesic_distance_eigen, geodesic_interp } from './wasm-logm/pkg/wasm_logm.js';

// Initialize the WASM module
await init();

// Use the functions
const n = 3;
const matrix = new Float64Array([...]); // Flat row-major matrix

// Method 1: Scaling and squaring (default, more stable)
const logm = matrix_logm(matrix, n);

// Method 2: Eigendecomposition via Schur decomposition
const logm_eigen = matrix_logm_eigen(matrix, n);
```

## Algorithms

### Scaling and Squaring Method (default)

The matrix logarithm is computed using the inverse scaling and squaring method:

1. Scale the matrix down by repeated square roots until it's close to identity
2. Compute log using Taylor series for matrices near identity
3. Scale back up

This is stable and accurate for orthogonal/unitary matrices.

### Eigendecomposition Method (new)

The matrix logarithm can also be computed using eigendecomposition:

1. Compute the Schur decomposition: M = Q T Q^H
2. Compute log(T) where T is quasi-triangular
3. Reconstruct: log(M) = Q log(T) Q^H

For rotation matrices in SO(n), eigenvalues lie on the unit circle, making the logarithm well-defined. This method provides an alternative implementation and can be useful for comparison or validation.

**Benefits:**
- More direct computation based on eigenvalues
- Useful for understanding the geometric structure
- Can handle 2x2 blocks (complex eigenvalue pairs) in the real Schur form

**Trade-offs:**
- May be less numerically stable for ill-conditioned matrices
- Requires successful Schur decomposition (falls back to scaling and squaring if it fails)

## Testing

Run the test suite:

```bash
cd wasm-logm
cargo test
```

The tests verify:
- Identity matrix: log(I) = 0
- 2D and 3D rotation matrices
- Comparison between eigendecomposition and scaling/squaring methods
