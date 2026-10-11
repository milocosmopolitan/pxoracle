#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p packages/contracts/schemas
cargo run --quiet --locked -p pxoracle-astrology --example schema > packages/contracts/schemas/astrology.json
cargo run --quiet --locked -p pxoracle-tarot --example schema > packages/contracts/schemas/tarot.json

node scripts/generate-persistence-validators.mjs

for kind in input plan semantics rules; do
  cargo run --quiet --locked -p pxoracle-tarot-reading --example reading-schema -- "$kind" > "packages/contracts/schemas/reading-$kind.json"
done
node scripts/generate-reading-types.mjs

for kind in input plan semantics rules; do
  cargo run --quiet --locked -p pxoracle-natal-reading --example natal-schema -- "$kind" > "packages/contracts/schemas/natal-$kind.json"
done
node scripts/generate-reading-types.mjs natal
