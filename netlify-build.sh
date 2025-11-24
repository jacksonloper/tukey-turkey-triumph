#!/bin/bash
# Netlify build script - installs Rust and wasm-pack only if needed, then builds the project

set -e

# Check if WASM pkg directory already exists (committed to repo)
if [ -d "wasm-logm/pkg" ] && [ -f "wasm-logm/pkg/wasm_logm_bg.wasm" ]; then
  echo "=== WASM pkg/ directory found - skipping Rust installation ==="
  echo "Using pre-built WASM artifacts from wasm-logm/pkg/"
  
  # Run npm build directly without Rust setup
  echo "=== Building project ==="
  npm run build
  
  echo "=== Build complete ==="
  exit 0
fi

echo "=== WASM pkg/ not found - setting up Rust toolchain ==="

# Ensure cargo is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Install Rust if not already available
if ! command -v rustc &> /dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION:-stable}
  source "$HOME/.cargo/env"
else
  echo "Rust already installed"
  # Source cargo env to ensure it's properly configured
  if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
  fi
fi

# Ensure we have a default toolchain set
if ! rustup default &> /dev/null; then
  echo "Setting default Rust toolchain to ${RUST_VERSION:-stable}..."
  rustup default ${RUST_VERSION:-stable}
fi

# Verify Rust is working
echo "Rust version: $(rustc --version)"
echo "Cargo version: $(cargo --version)"

# Add wasm32 target if not already installed
echo "Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown || true

echo "=== Installing wasm-pack ==="
# Install wasm-pack via cargo if not already available
if ! command -v wasm-pack &> /dev/null; then
  echo "Installing wasm-pack via cargo..."
  cargo install wasm-pack
else
  echo "wasm-pack already installed: $(wasm-pack --version)"
fi

echo "=== Building project ==="
# Now run the actual npm build
npm run build

echo "=== Build complete ==="
