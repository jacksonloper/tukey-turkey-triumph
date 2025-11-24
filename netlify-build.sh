#!/bin/bash
# Netlify build script - installs Rust and wasm-pack, then builds the project

set -e

echo "=== Installing Rust toolchain ==="
# Install Rust if not already available
if ! command -v rustc &> /dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION:-stable}
  source "$HOME/.cargo/env"
else
  echo "Rust already installed: $(rustc --version)"
fi

# Ensure cargo is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

echo "=== Installing wasm-pack ==="
# Install wasm-pack via cargo if not already available
if ! command -v wasm-pack &> /dev/null; then
  echo "Installing wasm-pack via cargo..."
  cargo install wasm-pack
else
  echo "wasm-pack already installed: $(wasm-pack --version)"
fi

# Ensure wasm-pack is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

echo "=== Building project ==="
# Now run the actual npm build
npm run build

echo "=== Build complete ==="
