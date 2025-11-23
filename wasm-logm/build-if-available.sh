#!/bin/bash
# Build WASM if wasm-pack is available, otherwise use committed pkg/

set -e

# Check if wasm-pack is available
if command -v wasm-pack >/dev/null 2>&1; then
    echo "wasm-pack found - building WASM module..."
    wasm-pack build --target web --release
    echo "WASM build complete"
else
    echo "wasm-pack not found - using pre-built WASM from pkg/ directory"

    # Verify pkg directory exists
    if [ ! -d "pkg" ] || [ ! -f "pkg/wasm_logm_bg.wasm" ]; then
        echo "ERROR: pkg/ directory not found or incomplete"
        echo "Either install wasm-pack or ensure pkg/ is committed to the repository"
        exit 1
    fi

    echo "Using committed WASM artifacts (pkg/ directory exists)"
fi
