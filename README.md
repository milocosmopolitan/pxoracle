# PXOracle

A private, browser-first tarot and Western astrology experience in an oracle’s pixel-art study.

## Implementation status

The npm/Cargo workspaces, two Rust engines, separately linked Emscripten WASM modules, typed Worker clients, Next.js static application, Zustand state, Three.js scenes, supplied 78-card art, and Storybook are implemented. Native tests, Node/WASM parity, static export, and Storybook builds have run successfully in the development environment. See [verification](docs/validation/STATUS.md) for exact evidence and outstanding gates. **This is not a claim of completed Safari/mobile or visual qualification.**

| Route | Experience | Calculation download |
| --- | --- | --- |
| `/` | Oracle’s study and two accessible entry links | None |
| `/tarot/` | One/three cards, selection, reveal, reflective reading, explicit save/restore | Tarot worker + WASM on first action |
| `/astrology/` | Local birth information, ten celestial bodies, Whole Sign chart | Astrology worker + WASM on calculation |

## Run locally

Prerequisites: Node 22.16+ (development verified on Node 24.19), npm, Rust 1.90.0, Emscripten 4.0.10. Activate the Emscripten SDK in the current shell before building. The Rust toolchain file installs the target. Runtime WebP art is checked in; the original uploads do not need to be downloaded to run the app.

```bash
npm ci
cargo test --locked
npm run wasm
npm run dev
```

```bash
npm run typecheck
npm run build             # apps/web/out/ — deploy these files to S3
npm test                  # requires WASM and static build
npm run storybook         # localhost:6006, deterministic mocks
npm run build-storybook
node scripts/check-boundaries.mjs
bash scripts/generate-schemas.sh
```

Browser integration tests are defined for Chromium, Firefox, and WebKit in `playwright.config.ts`. They run against exported HTML, not Next’s development server. WebKit is not branded Safari; actual Safari and mobile device qualification remain separate requirements.

## AWS S3 deployment

This is a fully static export: `output: 'export'`, `trailingSlash: true`, no application server/API routes/middleware. See [S3 and CloudFront](docs/deployment.md). A CloudFront viewer-request function resolves `/tarot/` to `/tarot/index.html` for a private S3 REST origin. The optional deployment script requires explicitly supplied bucket/distribution identifiers. No AWS deployment was performed as part of implementation.

## Boundaries

- Rust cores own astronomical/reading semantics. They do not own DOM, images, local storage, or animation.
- Astronomy Engine C is vendored at a fixed commit under its MIT license; one mutex guards all native C calls and its mutable caches.
- Each engine has its own Worker and WASM. The C shim and astrology Rust code are statically linked into the same module.
- A persistent client canvas hosts separately imported scenes; Zustand survives route changes outside scene lifetimes.
- Card illustrations and English reflective content load separately. Hidden deck order is never given to scenes; local session storage contains the actual full deck to restore unfinished readings.
- Save/delete is explicit. Tarot questions remain in memory; they are never included in saved readings. Birth records are saved only on request. No analytics or remote geocoding is included.

See [architecture](ARCHITECTURE.md), [decisions](docs/decisions/README.md), [contracts](docs/contracts/README.md), and [contributing](CONTRIBUTING.md).

## Accuracy and interpretation

The initial chart is tropical, apparent geocentric true ecliptic/equinox of date; ten bodies; major aspects; Whole Sign houses. UTC approximates UT1 (no DUT1 correction); Astronomy Engine supplies its default Espenak–Meeus delta-T. Local historical times use pinned `chrono-tz` data, never the device time zone. DST gaps and folds require explicit resolution.

Dates are restricted to 1900–2100 for this initial profile. This is an input support policy, **not a certified accuracy bound across that whole interval**. Unknown/approximate times omit angles, houses, and aspects; midpoint positions and 15-minute sampled possible signs are disclosed. Sampling is not a rigorous extrema proof. Polar locations at |latitude| ≥66° omit angles/houses with a warning.

Tarot uses SplitMix64 and unbiased rejection-sampled Fisher–Yates with browser-supplied entropy. It is deterministic for testing, not intended as a cryptographic lottery. Actual serialized results, not seeds, are restored.

Astrology and tarot interpretations are reflective content, not scientifically validated predictions. The initial English pack is deliberately concise and needs editorial review before commercial launch.

## Art and licenses

The user supplied six original archives. Runtime copies preserve transparency, use nearest-neighbor reduction and lossless WebP, and retain source hashes/dimensions in `assets/manifests/art.json`. Original files are unchanged. `scripts/import-assets.py` rebuilds runtime copies from the extracted source directories (Pillow required). All 78 card IDs are mapped and checked. Door exploration and unused source variants remain in the original archives, not the runtime download.

No repository-wide redistribution license is inferred for supplied art or project code. Third-party Astronomy Engine retains its upstream MIT license in its vendor directory.
