#!/bin/bash
set -e

echo "Building WASM logm module..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build the WASM module
wasm-pack build --target web --release

echo "Build complete! WASM module is in wasm-logm/pkg/"
