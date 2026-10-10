#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v emcc >/dev/null || { echo "Activate Emscripten 4.0.10 first"; exit 1; }
cargo build --locked --release --target wasm32-unknown-emscripten -p pxoracle-astrology-wasm -p pxoracle-tarot-wasm
for feature in astrology tarot; do
  mkdir -p "apps/web/public/engines/$feature"
  emcc "target/wasm32-unknown-emscripten/release/libpxoracle_${feature}_wasm.a" -O2 --no-entry \
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createEngine \
    -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 \
    -sEXPORTED_FUNCTIONS='["_px_process","_px_free","_malloc","_free"]' \
    -sEXPORTED_RUNTIME_METHODS='["UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAPU8"]' \
    -o "apps/web/public/engines/$feature/engine.mjs"
  cp scripts/worker.mjs "apps/web/public/engines/$feature/worker.mjs"
done
