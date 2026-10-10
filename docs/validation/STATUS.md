# Verification status

## Executed in the implementation environment

- Rust 1.90 native tests: angle wraparound, natal smoke checks, historical Seoul offset, DST gap/fold and 23/25-hour local days, unknown time, ephemeris J2000 Sun, PRNG reference values, 1,000 deck permutations, idempotency, save/restore, tamper rejection.
- C and Rust statically linked using Emscripten 4.0.10 into two independent WASM modules.
- Actual Node/WASM versus Rust-native JSON comparison: exact/uncertain charts across several dates, all ten bodies, tolerance 1e-8 for numerical parity; tarot deterministic vectors and serialized restore.
- 500 repeated tarot calls with paired input/output freeing and no WASM heap growth after warmup. This does not prove absence of every leak or establish browser memory usage.
- TypeScript type check; Next.js production static export of all three routes; standalone Storybook build.
- Supplied art maps exactly 78 canonical IDs; runtime files and content entries checked.
- Rust-generated JSON schema fixtures and source ownership guard.

`node-wasm-baseline.json` records raw/gzip sizes, import names, initial timing, heap observation, and the actual Node runtime. Timing is a single development-container baseline, not a browser/mobile benchmark. Emscripten runtime resolves the recorded env/WASI imports; the app does not need a WASI server.

## Browser gate

`tests/browser/app.spec.ts` defines real-engine static-host flows, feature-only WASM requests, save/reload, history, failed-WASM retry, and single-canvas navigation for Playwright Chromium, Firefox, WebKit. The GitHub workflow executes these checks and saves reports. Their status must be taken from the actual workflow run, not inferred from source.

First CI run (38080607692) passed all three normal-flow/navigation tests on Chromium, Firefox and WebKit (9 passes). Its three retry tests incorrectly matched the Next.js route-announcement alert before the actual engine error. The retry locator is narrowed to the production error notice and is being rerun. This is a test synchronization correction, not a claim that the original run passed.

Local browser preview/interaction was unavailable under this environment’s supported preview workflow. No local browser, Safari, or physical mobile results are claimed. WebKit automation is not Safari qualification.

## Remaining qualification before claiming all three epics complete

- Actual browser CI evidence and remediation of any observed failures.
- Actual Safari and representative mobile testing, visual review of supplied art composition, keyboard/screen-reader checks.
- Repeated-navigation GPU/frame/memory measurements and budgets on representative devices; Storybook interaction/HMR checks.
- Independent, condition-aligned astronomical reference certification beyond native/WASM parity and J2000 smoke checks, including ASC/MC and sign/house boundaries across the supported date interval.
- Editorial review of the initial English reflective content; certified interval-extrema behavior if required instead of explicitly disclosed 15-minute sampling.

Do not close #17 or #24 on build success alone. Track per-child acceptance evidence in the implementation PR. No AWS deployment was requested or performed; S3 compatibility is verified by static output.
