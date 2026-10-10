# Verification status

Baseline qualification: [successful workflow 38083929265](https://github.com/milocosmopolitan/pxoracle/actions/runs/38083929265), source commit `c5d0aa72e75b6f638476181118f2273bf22f8613`. Current head checks are attached to PR #26. The subsequent Storybook mobile viewport adjustment is covered by that head's story checks.

## Executed checks

- 10 Rust tests: natal smoke, circular angles, historical offset, DST gap/fold, 23/25-hour local days, unknown time; PRNG vectors, 1,000 permutations, idempotency/completion, actual-result restore and tamper rejection.
- 15 Node tests: actual native/WASM parity at 1e-8; independent Swiss/Moshier reference fixtures; exact aspect-orb inclusion/exclusion and Whole Sign cusp boundaries; schemas, generated persistence validators, worker eviction/correlation, abandoned scene cleanup and texture leases, art/content mapping.
- C and Rust linked with Emscripten 4.0.10. TypeScript, Next.js static export of all routes, and standalone Storybook build pass.
- 21 app browser tests pass. Three intentionally skipped cases are the same allocation benchmark on non-Chrome projects; the benchmark runs once on actual Chrome. Functional checks cover all four projects.
- Two Storybook tests pass: eight isolated states, body selection, three-card selection/reveal, retry, no engine requests, and three dev HMR updates without increased scene listener ownership.
- Actual macOS Safari smoke passes: landing, real tarot WASM selection/reveal, real astrology WASM ten-body chart. Screenshots and native Safari capabilities are retained.
- Visual review: supplied art composition on desktop, production mobile emulation, and actual Safari; Storybook desktop states. Mobile Storybook uses an actual viewport global in addition to its container width.

| Environment | Observed version | Scope |
| --- | --- | --- |
| Google Chrome | 155.0.8059.39 | Real engines, routes/history, saves/restores, retry, graphics and allocation/frame baseline |
| Firefox | 142.0.1 | Real engines and HTML flows; hosted runner cannot initialize WebGL, so HTML fallback is explicitly checked |
| Playwright WebKit | 26.0 | Full app flow; this is not labeled Safari |
| Pixel 7 viewport / Chromium | 141.0.7390.37 | Touch/size/reduced-motion emulation, not a physical Android device |
| Actual Safari / macOS | 26.6 / 14.8.9 | Native safaridriver, no simulator, real engines and graphics |

Most functional automation uses reduced motion for deterministic interaction. The Chrome allocation/frame benchmark explicitly uses standard motion at 640×480. Actual Safari smoke also uses its normal motion setting.

## Measured limits and budgets

See `node-wasm-baseline.json`, `browser-baseline.json`, `safari-capabilities.json`, `safari-result.json`, and `astronomy-reference.md` for raw evidence. Node initialization/call timings are development/CI samples, not browser latency guarantees.

- No WASM request on landing; only the selected feature's engine downloads on first calculation. Tarot restores actual serialized state; astrology restores a schema-validated saved chart without recalculation or an engine download.
- Seven complete astrology → tarot → landing cycles: 10–11 live GL textures, 24 buffers, one program. The bounded one-texture difference reflects expression texture use. Regression gate: final live count may not exceed the warmed sample by more than one. No monotonically growing allocation count was observed; this is not an unlimited-duration leak proof.
- Standard-motion CI frame interval at 640×480: median 33.4 ms, p95 50 ms, 59 intervals after discarding the initial clock-phase sample. These are software-rendered CI measurements, not a physical-device FPS promise. Normal rendering is capped at 30 fps; reduced-motion/frozen scenes draw only when state, size or scene changes.
- 500 repeated tarot calls show no WASM heap growth after warmup. This does not measure all browser memory or certify absence of every leak.
- Numerical regression limits: longitude/latitude one arcminute, speed 0.001 degrees/day, ASC/MC 0.002 degrees. Six independently calculated date cases span 1900–2100; this does not certify every instant in that interval.

## Reproduce

```sh
cargo test --locked
npm run wasm
npm run typecheck
npm run build
npm test
npm run build-storybook
npx playwright install --with-deps chromium firefox webkit chrome
npx playwright test
npx playwright test --config playwright.storybook.config.ts
# macOS with Safari Remote Automation enabled:
python3 tests/safari/smoke.py apps/web/out
```

Storybook HMR testing temporarily edits its harness source and restores it in `finally`. The static test uses production components/scenes with conspicuously labeled mocks; production browser tests use real engines.

Physical mobile hardware, manual screen-reader audits and representative hardware GPU benchmarks were unavailable. Hosted Firefox graphics are not qualified beyond the functioning fallback. Unknown/approximate birth-time placements use disclosed 15-minute sampling, not certified interval extrema. The concise English content is an initial reflective pack. These support/accuracy/editorial limits are explicit and are not represented as executed tests.

No AWS deployment has been performed. Deployment readiness is the real static export plus S3/CloudFront routing, MIME, caching and upload configuration. See `acceptance.md` for per-child evidence.
