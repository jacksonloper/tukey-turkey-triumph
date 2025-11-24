#!/bin/bash
# Build WASM only if pkg/ doesn't exist, otherwise use committed pkg/

set -e

# Check if pkg/ directory already exists (committed to repo)
if [ -d "pkg" ] && [ -f "pkg/wasm_logm_bg.wasm" ]; then
    echo "✅ Using pre-built WASM from pkg/ directory (skipping wasm-pack)"
    exit 0
fi

# pkg/ doesn't exist - need to build
echo "pkg/ not found - checking for wasm-pack..."

# Check if wasm-pack is available
if command -v wasm-pack >/dev/null 2>&1; then
    echo "wasm-pack found - building WASM module..."
    wasm-pack build --target web --release
    echo "WASM build complete"
else
    echo "ERROR: pkg/ directory not found and wasm-pack not available"
    echo "Either install wasm-pack or ensure pkg/ is committed to the repository"
    exit 1
fi
