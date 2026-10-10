# PXOracle

PXOracle is a browser-first tarot and Western astrology experience set in a premium celestial pixel-art world. An oracle character guides visitors from a quiet room into either a card reading at the table or an interactive chart inside a crystal ball.

**Status: architecture and implementation planning.** This repository begins with documentation. Engines, WASM builds, scenes, and browser qualification are not implemented or verified yet.

## Product experience

| Route | Experience | Calculation dependency |
| --- | --- | --- |
| `/` | Oracle, room, table, and choice of reading | None |
| `/astrology` | Birth information, chart calculation, crystal-ball entry, planet exploration | Astrology WASM, loaded on demand |
| `/tarot` | Question, spread, card selection, reveal, and reading | Tarot WASM, loaded on demand |

One persistent browser canvas and renderer host three independently managed scenes. Navigation should preserve visual continuity while keeping URL history, loading states, and accessible HTML controls correct. Direct visits to any route must work without visiting the landing page.

## Technical direction

- **Rust:** independent astrology and tarot domain engines, usable natively and through separate WASM artifacts.
- **Astronomy Engine C:** preferred astronomical backend behind a small internal FFI boundary. Native and browser integration requires a build/accuracy spike before commitment to a toolchain.
- **TypeScript + Three.js:** scenes, camera transitions, animation, interaction, and rendering.
- **Next.js App Router:** static route content, metadata, accessible forms and reading panels, and the persistent client runtime.
- **npm workspaces + Cargo workspace:** one repository with explicit package and crate ownership.
- **Web Workers:** initialize only the needed calculation engine; avoid coupling calculation to render frames.
- **Independent content and art packs:** card illustrations, translations, and interpretation text are not embedded in engine WASM.

See [ARCHITECTURE.md](ARCHITECTURE.md) for dependency rules, proposed folders, data contracts, resource ownership, and unresolved decisions.

## Initial scope

### Astrology

Tropical zodiac, geocentric positions, ten bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto), ASC/MC, Whole Sign houses, and conjunction/sextile/square/trine/opposition.

Birth time accuracy is explicit. Unknown time produces supported date-range results without invented ASC or houses. Historical timezone ambiguity must be resolved explicitly. Transits, Placidus, sidereal profiles, and synastry follow the first natal-chart experience.

### Tarot

A standard 78-card configuration; one-card and three-card spreads; selection without replacement; separately recorded card orientation; and versioned interpretation references. Reversals are supported but disabled by default. The first three-card spread uses situation, what to examine, and possible next action.

Artwork is independent from stable card IDs. The PXOracle deck preserves deliberate symbolism while allowing diverse people and removing unwanted religious bias. Changes to meaning require content/profile versioning rather than silently changing saved readings.

### Local frontend and storyboard

A runnable local application should demonstrate all three routes, lazy loading, navigation and return, card reveal, chart element selection, loading/retry states, and reduced motion. Clearly labeled mock providers allow scene work before real engines are ready; mock data must never be presented as calculated output.

## Repository map

The folders below are **planned**, not a claim that they exist:

| Path | Owner |
| --- | --- |
| `apps/web` | Next.js routes, app state, browser composition, local storyboard |
| `packages/scene-runtime` | Persistent renderer, scene lifecycle, transitions, shared resource leases |
| `packages/scenes` | Independently imported landing, astrology, and tarot scene entrypoints |
| `packages/engine-client` | Typed worker clients and separate lazy loaders |
| `packages/contracts` | Versioned browser protocol schemas and fixtures |
| `crates/pxoracle-ephemeris` | C backend build, private FFI, astronomical conversion |
| `crates/pxoracle-astrology` | Astrology domain calculations |
| `crates/pxoracle-astrology-wasm` | Astrology browser adapter |
| `crates/pxoracle-tarot` | Tarot domain and session calculations |
| `crates/pxoracle-tarot-wasm` | Tarot browser adapter |
| `content` | Interpretation and locale packs |
| `assets` | Art manifests and approved source metadata |
| `docs` | Decisions, contracts, storyboard, and validation plans |
| `tests` | Cross-boundary fixtures and browser integration |

## Development

There are no working install/build/run commands yet. The scaffold epic will introduce pinned toolchains, workspace manifests, truthful commands, and minimal checks. Engine and frontend epics will add runnable implementations.

The C/WASM path should use Rust 1.89 or later for the standardized `wasm32-unknown-unknown` C ABI. ABI compatibility does not supply C libc/libm or prove an Astronomy Engine build. Final Rust/Clang/SDK versions and target will be pinned after the backend spike.

## Delivery order

1. Scaffold folders, documentation, ownership, versioned contracts, and architecture decisions.
2. Implement and qualify the two independent engines.
3. Implement the Next.js app and three local scenes; scene work may start with contract-conforming mocks after the scaffold contracts are ready.

Each epic must link its child issues and dependencies. Completion requires evidence for its acceptance criteria, not just source files.

## Validation principles

- Compare astronomy results only after aligning time scales, coordinate frames, and correction policy.
- Test angle wraparound, boundaries, historical local times, unknown birth time, and native/WASM agreement.
- Test tarot permutation invariants, deterministic reference vectors, duplicate actions, and saved-result restoration.
- Verify that landing does not download either engine and each feature does not download the other engine.
- Exercise direct links, rapid navigation, browser history, asset failures, reduced motion, keyboard access, and resource cleanup.
- Record artifact sizes and representative mobile performance before setting final budgets.

## Privacy and interpretation

Calculation is intended to run locally. Browser-side locality must be verified through network tests. Birth information and tarot questions must not enter URLs, analytics, or logs. Saving is explicit, versioned, and removable; any future location lookup service must disclose what it receives.

Astronomical positions and interpretive content are separate. Astrology and tarot readings are reflective content, not scientifically validated predictions.

## References

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — preferred MIT-licensed backend candidate.
- [Rust 1.89 C ABI change](https://blog.rust-lang.org/2025/08/07/Rust-1.89.0/#standards-compliant-c-abi-on-the-wasm32-unknown-unknown-target).
- [Rust WASM target guidance](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html).

A repository license has not been selected. Do not assume third-party code, generated assets, and future commercial deck art share one license.
