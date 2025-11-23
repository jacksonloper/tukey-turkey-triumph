# WASM Matrix Logarithm Module

This module provides high-performance matrix logarithm and related functions using Rust and nalgebra, compiled to WebAssembly.

## Features

- `matrix_logm`: Matrix logarithm for orthogonal/unitary matrices
- `matrix_expm`: Matrix exponential
- `geodesic_distance`: Geodesic distance between rotation matrices on SO(n)
- `geodesic_interp`: Geodesic interpolation between rotation matrices

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
import init, { matrix_logm, geodesic_distance, geodesic_interp } from './wasm-logm/pkg/wasm_logm.js';

// Initialize the WASM module
await init();

// Use the functions
const n = 3;
const matrix = new Float64Array([...]); // Flat row-major matrix
const logm = matrix_logm(matrix, n);
```

## Algorithm

The matrix logarithm is computed using the inverse scaling and squaring method:

1. Scale the matrix down by repeated square roots until it's close to identity
2. Compute log using Taylor series for matrices near identity
3. Scale back up

This is stable and accurate for orthogonal/unitary matrices.
