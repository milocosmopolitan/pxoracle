# Epic acceptance map

Implementation is collected in PR #26. Execution status and environment limits live in `STATUS.md`; source presence alone is not browser qualification.

| Issue | Delivered boundary | Reproducible evidence |
| --- | --- | --- |
| #4 | npm/Cargo ownership and pinned toolchains | `npm ci`, `cargo test --locked`, lockfiles, AGENTS.md |
| #5 | ADRs and dependency guard | `node scripts/check-boundaries.mjs` |
| #6 | Rust-generated schemas, typed feature wire contracts | schema tests, fixture TypeScript check, native/WASM tests |
| #7 | prepare/enter/update/exit/dispose, stale generations and leases | contracts guide, lifecycle tests |
| #8 | canonical 78-card art/content manifests and story inventory | contracts/art checks, source hashes, Storybook guide |
| #9 | reproducible handoff and CI | README, CONTRIBUTING, verify workflow |
| #10 | pinned C backend linked into native Rust and Emscripten | native/WASM parity, imports/sizes baseline, upstream provenance |
| #11 | historical IANA conversion and explicit input errors | DST gap/fold, 23/25-hour days, historical-offset fixtures |
| #12 | ten bodies, ASC/MC, Whole Sign and uncertainty | independent six-date reference cases, cusp/wrap tests, unknown-time tests |
| #13 | major aspects, settings/provenance and meaning IDs | exact-orb inclusion/exclusion, uncertain omission, content reference tests |
| #14 | full deck validation and deterministic unbiased shuffle | fixed PRNG vectors, 1,000 permutations, one/three-card validation |
| #15 | stable selection, reveal, completion and actual-state restore | idempotency, repeated completion/reveal, tamper rejection, restored vectors |
| #16 | lazy separate Worker/WASM clients and failure eviction | out-of-order/eviction tests, actual browser feature isolation and retry |
| #17 | real browser calculations and numerical/build baseline | CI browser reports, actual Safari job, numerical/Node baseline documents |
| #18 | three exported Next routes, persistent canvas, Zustand | static-output checks, direct route/history/no-landing-WASM tests |
| #19 | scene cancellation, leases, disposal and accessible fallback | lifecycle tests, navigation allocation samples, reduced-motion/mobile flow |
| #20 | supplied room/oracle/table composition and feature entry | real browser screenshots, landing/loading/retry stories |
| #21 | crystal chart UI and truthful unknown-time flow | real ten-body calculation, selection story, uncertain-time browser test |
| #22 | on-demand tarot art, stable slots and orientation | actual shuffle/select/reveal, one/three-card core checks, mock feature story |
| #23 | real isolated engines, separate content and explicit persistence | tarot result restore; schema-validated chart restore without WASM/recalculation; delete controls |
| #24 | app/Storybook interaction, visual evidence and measured limits | browser tests, screenshots, resource/frame baseline, HMR test |
| #25 | runnable production-code Storybook harness | standalone build, static stories, dev HMR, no real-engine request assertion |

The scaffold and domain/frontend work are delivered together. The initial scaffold-only constraints in #4/#9 describe sequencing; later engines/scenes and browser qualification intentionally belong to epics #2/#3. No mock calculation replaces a production engine. No AWS deployment is implied by static-export qualification.
