#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p packages/contracts/schemas
cargo run --quiet --locked -p pxoracle-astrology --example schema > packages/contracts/schemas/astrology.json
cargo run --quiet --locked -p pxoracle-tarot --example schema > packages/contracts/schemas/tarot.json

node scripts/generate-persistence-validators.mjs
