# Accepted decisions

| Decision | Status | Rationale / consequence |
| --- | --- | --- |
| npm + Cargo workspaces | Accepted | Four browser packages, five independent Rust crates; lockfiles define resolved dependencies. |
| Next.js App Router static export | Accepted | S3 deployable output, trailing-slash directories, no server runtime. CloudFront rewrites document paths. |
| Zustand root provider | Accepted | Per-provider initialization avoids SSR singleton state; one store survives client navigation. Explicit save/delete only. |
| Persistent Three.js renderer | Accepted | Separate scene imports with abort/generation checks; scenes own local resources, shared texture leases own textures. |
| Emscripten 4.0.10 + Rust 1.90.0 | Accepted | Actual native/WASM parity passes. C and Rust static libraries link to one module per feature. Emscripten supplies libc/libm/allocator and exception runtime. |
| Bare wasm32-unknown-unknown | Deferred | C ABI compatibility alone does not supply the C runtime. No bare-target success or size comparison is claimed. Emscripten is the verified delivery target. |
| Raw JSON C ABI rather than wasm-bindgen | Accepted | Matching toolchain supports explicit allocation; no assumptions about wasm-bindgen on Emscripten. Input NUL UTF-8 belongs to JS allocator; output CString belongs to Rust and is freed with px_free. |
| Embedded chrono-tz | Accepted | Historical IANA rules travel with the astrology WASM; no browser time-zone database dependency. Version is included in chart provenance. |
| UTC-as-UT1, backend delta-T | Provisional accuracy policy | Explicit approximation without DUT1/EOP data; not an observatory-grade timing claim. |
| Unknown/approximate birth time | Accepted conservative presentation | Local-day range respects DST; omit angles/houses/aspects; disclose midpoint and sampled signs. Certified interval extrema remain a separate accuracy improvement. |
| SplitMix64 + rejection Fisher–Yates | Accepted | Fixed testable algorithm version, no modulo bias in bounded draws; crypto entropy from browser, not animation. |
| Art/content external to WASM | Accepted | 78 stable IDs, separate English content pack, only revealed faces requested. Source hashes retained. |
| Browser/resource qualification | Accepted with measured limits | Actual Chrome/Firefox/Safari plus WebKit/mobile emulation, bounded seven-cycle GL allocation baseline, and HMR checks. Physical mobile and hardware GPU budgets remain unqualified; see validation/STATUS.md. |

No library/source license is silently applied to the supplied art. AWS deployment bootstrap and explicit publishing are covered by ADR 005.

Tarot table choreography: [ADR 002](002-tarot-table-choreography.md).

Perspective camera and separate arm rig: [ADR 003](003-tarot-perspective-rig.md).

Deterministic free readings: [ADR 004](004-deterministic-free-readings.md).

Manual static publishing: [ADR 005](005-manual-static-publishing.md).

Exhaustive reading export: [ADR 006](006-exhaustive-reading-export.md).

Local city input, natal interpretation and crystal exploration: [ADR 007](007-local-natal-readings.md).
