# Contributing

Read README for setup and ARCHITECTURE for ownership. Use focused changes with evidence for the behavior changed. Do not treat Storybook fixtures as engine reference evidence.

- `apps/web`: Next route HTML, React interaction, Zustand, explicit persistence, Storybook.
- `packages/contracts`: Rust-generated JSON schemas, TypeScript wire views, stable IDs.
- `packages/engine-client`: transport, lifecycle, typed calls. No domain math.
- `packages/scene-runtime`: canvas/rendering, transition intent, texture leases.
- `packages/scenes`: feature visuals only, no Worker initialization or storage.
- `crates/pxoracle-ephemeris`: upstream C, minimal shim, serialized safe facade.
- `crates/pxoracle-astrology` and `crates/pxoracle-tarot`: independent domain logic.
- `*-wasm`: serialization adapters and narrow allocation contract.
- `content`, `assets`: versioned interpretation and source-to-runtime mappings.
- `infra`, `scripts`: reproducible builds and explicit deployment helpers.
- `tests`, `docs`: cross-boundary evidence and decisions.

Run `node scripts/check-boundaries.mjs`. Rust DTO changes require `bash scripts/generate-schemas.sh` and fixture/schema tests. Commit updated npm/Cargo lockfiles when dependencies change. WASM output is generated, not hand-edited or committed.

Tests must cover state invariants, invalid inputs, DST boundaries, native/WASM numerical agreement, and resource cleanup. Browser tests operate on the static export. Report the actual browser engine/device and any missing gate. Do not use 'Safari' as a synonym for Playwright WebKit.
