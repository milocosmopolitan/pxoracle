# PXOracle Architecture

**Status:** implementation baseline, 2026-10-10. See `docs/validation/STATUS.md` for measured results and unqualified browser/device gates. Accepted implementation choices supersede provisional wording below: Next.js static export to S3, Zustand client state, Emscripten 4.0.10, Rust 1.90.0, and embedded chrono-tz historical rules.

## 1. Design goals

Deliver three route-specific experiences in one visual world, with independent Rust engines loaded only when needed. Preserve approved pixel artwork, support accessible HTML interaction, and allow engine, scene, art, and interpretation changes without cross-layer rewrites.

The first delivery runs locally and produces an S3-compatible static export. AWS account provisioning and commercial deck entitlement services are outside this delivery.

## 2. Dependency and ownership rules

| Component | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| Next.js app | Routing, HTML UI, session persistence, orchestration | Engine clients, scene runtime, scene entrypoints, contracts, content | Domain calculations or private C pointers |
| Scene runtime | Renderer/canvas, frame loop, transition coordination, shared GPU assets | Three.js, presentation contracts | Reading rules, birthplace conversion, PRNG |
| Feature scenes | Objects, animations, picking, scene-local resources | Runtime, display data, asset manifests | WASM initialization, fetch of birth records, persistence |
| Engine client | Worker creation, lazy imports, request identity, error transport | Protocol contracts, feature adapters | Domain algorithms or Three.js objects |
| Astrology core | Zodiac, houses, aspects, uncertainty, chart assembly | Ephemeris interface | DOM, JS runtime, network, filesystem, rendering |
| Ephemeris adapter | Backend C source/build, time/frame adaptation, safe Rust facade | Reviewed backend, limited FFI | Interpretation or UI |
| Tarot core | Deck/spread validation, shuffle, selection, orientation, reading references | Domain data and RNG abstraction | Artwork, HTML, network, GPU |
| WASM adapters | Browser serialization and error conversion | Corresponding core and binding tools | New independent business logic |
| Content/art packs | Interpretation text, translations, visual assets and mappings | Stable IDs and schemas | Engine state mutation |

Astrology and tarot cores have no dependency on each other. The app may combine their serialized results later. There is no generic “oracle engine” in the initial scope.

## 3. Workspace

```text
apps/web/
  app/layout.tsx
  app/page.tsx
  app/astrology/page.tsx
  app/tarot/page.tsx
  src/runtime/
  src/features/
  src/state/
  .storybook/
  src/stories/
packages/
  contracts/
  engine-client/
    src/astrology/
    src/tarot/
  scene-runtime/
  scenes/
    src/landing/
    src/astrology/
    src/tarot/
crates/
  pxoracle-ephemeris/
  pxoracle-astrology/
  pxoracle-astrology-wasm/
  pxoracle-tarot/
  pxoracle-tarot-wasm/
content/
  astrology/
  tarot/
assets/
  manifests/
  sources/
docs/
  decisions/
  contracts/
  storybook/
tests/
  fixtures/
  browser/
```

Scaffolding creates manifests, purposeful placeholder modules or folder READMEs, and ownership documents. It must not implement natal calculations, card algorithms, or production scenes.

Use separate scene and engine entrypoints. A common barrel must not eagerly import all features. Rust generates browser artifacts into ignored build directories; deployment copies versioned artifacts into feature-specific paths. Source assets and runtime assets have different owners and manifests.

## 4. Routes and persistent rendering

Client state uses a per-root-provider Zustand vanilla store. No mutable global store is accessed during server rendering. User-triggered persistence is outside the scene runtime; unhydrated state is identical on server and client.

Use Next.js App Router with a client runtime mounted in the root layout, above feature route content. It owns one canvas and one Three.js renderer. Server-rendered route content provides page metadata, headings, forms, and usable loading/fallback UI.

| Route | Scene | Feature engine |
| --- | --- | --- |
| / | Landing room | None |
| /astrology | Crystal exterior and interior chart | Astrology |
| /tarot | Table and card reading | Tarot |

One renderer does not imply one camera: scenes can have their own cameras and presentation state. The runtime selects active views and coordinates transitions.

Static export is the implemented deployment shape (`output: export`, `trailingSlash: true`). The scaffold ADR must explain direct route resolution for a static host. No server-only feature is required by the two engine workflows.

## 5. Scene lifecycle and navigation

A scene implements asynchronous preparation, enter, update, exit, and disposal. The exact TypeScript interface is established in the scaffold contract. Required behavior:

- Preparation can be abandoned; late results cannot activate an obsolete route.
- Only the active scene accepts input and runs its regular update loop.
- Transitions may briefly retain source and destination resources under explicit ownership.
- Scene disposal releases local geometry, materials, textures, listeners, and timers.
- Shared assets use leases/reference counts and are not disposed by individual scenes.
- App state, calculation results, and reading sessions survive scene disposal.

The router is authoritative for navigation intent. A transition coordinator assigns a generation to each navigation, prepares only the latest destination, and ignores stale completion. Worker computation is not necessarily abortable: obsolete responses must be discarded; terminating an instance is a separate policy.

During an in-app move, begin destination preparation while playing the source exit. If essential assets are not ready, show a bounded waiting presentation and accessible status. Preserve retry and navigation controls on failure.

Direct entry, reload, back/forward, and rapid repeated navigation must not require the previous scene. Reduced motion uses a short fade or immediate change. Focus moves to the destination heading/control after commit; Canvas effects do not hide keyboard navigation.

## 6. Loading and memory

Each engine has a distinct module, artifact URL, worker entry, and initialization Promise. Deduplicate concurrent initialization, evict failed Promises for retry, and cache successful initialization where appropriate.

Landing must not fetch either WASM. Astrology must not fetch Tarot WASM, and vice versa. Next.js route prefetch is separate from explicit WASM and large asset prefetch. Do not use route imports that initialize engines as side effects.

Initialize a worker only on feature demand. The initial policy retains initialized workers for quick revisits, while allowing explicit idle eviction. Restore from serialized session data after eviction, never from pointers into a previous WASM instance.

HTTP download cache, compiled WASM module, live WASM memory, JS heap, and GPU textures are separate resources. Measure them separately. Do not set numerical size or memory claims before measuring builds and representative devices.

Interpretation packs load by language/profile. Tarot art loads by selected deck, with the card back and selected/revealed faces prioritized over all full-resolution faces. Keep art and interpretation text outside WASM.

## 7. Browser contracts

Feature APIs use versioned serializable DTOs. Rust types own engine semantics; explicit schemas/fixtures define the browser wire contract. Generate TypeScript declarations where practical and gate schema/type drift in CI.

Worker requests contain protocol version, request ID, operation, and payload. Responses contain matching identity and either a result or a stable error code/message. Engine results include schema and engine versions; feature results include relevant backend/deck/content provenance.

Scene-facing view models are built by TypeScript from engine results. Longitudes and card IDs cross the boundary; camera coordinates, meshes, and animation curves do not. Never pass native or WASM pointers through application state.

## 8. Astrology contracts

Inputs distinguish local birth record, IANA timezone, resolved UTC instant or possible interval, latitude/longitude, time accuracy, and explicit settings. Coordinates use documented units and longitude sign. Place lookup belongs to the app. Historical timezone resolution belongs to an explicit conversion adapter, with pinned data or documented limitations.

Ambiguous/nonexistent local times require resolution; the device timezone is never substituted. Unknown birth time means the actual local-date interval, including DST-length days, rather than an invented noon instant.

Results contain bodies, angular speed, zodiac placement, supported angles/houses, aspects, uncertainty, warnings, and provenance. Use f64 and normalized circular angles. Unknown time omits ASC/houses and reports possible sign changes and unsupported interpretations. Approximate times propagate interval uncertainty.

Time scales (UTC, UT1, TT), epoch, coordinate frame, apparent/geometric corrections, delta-T policy, supported date range, and speed derivation must be explicit. ASC/MC and Whole Sign assignment belong to astrology; global backend accuracy does not establish chart accuracy automatically.

Preferred backend: Astronomy Engine C behind a safe Rust facade. Build both C and Rust into one astrology WASM module. Tarot remains a separate module. Rust 1.89+ supplies the standardized wasm32-unknown-unknown C ABI, but libc/libm, allocator integration, and compiler/linker settings remain build work.

The backend spike compares bare WASM plus required runtime support with an Emscripten route and documents the selected toolchain. Do not assume wasm-bindgen works identically across targets. Check backend global mutable state and allocation paths; serialize native access or provide isolation as needed. One worker instance does not establish native thread safety. Disable current-time access when appropriate and pass explicit times. Preserve upstream licensing and prohibit unsafe floating-point optimizations that break reference agreement.

Initially support natal chart calculations only. Additional systems must be explicit profiles, not silent fallbacks.

## 9. Tarot contracts

Separate CardDefinition, DeckDefinition, DeckArtManifest, SpreadDefinition, ContentPack, and ReadingSession. Stable IDs are independent from localized names and images. A deck declares its actual composition; partial development decks are explicitly marked.

The first spreads are one card and three cards with position IDs for situation, examination, and next action. Orientation is explicit; reversals default off with a configurable probability.

The browser supplies entropy using crypto.getRandomValues. Rust uses a versioned deterministic PRNG and unbiased Fisher–Yates permutation through a testable RNG abstraction. Record the algorithm version. Determinism supports testing and replay, not prediction claims.

Fix shuffled order and orientations before selection. Visual slot IDs map to distinct positions in that permutation. Selection and reveal are different actions; repeated calls are idempotent. Frontend animation cannot redraw a card or alter an existing result.

Persist actual selected cards, orientations, position assignments, and reveal state as restoration truth. A seed alone is insufficient across algorithm changes. Retaining full shuffled order permits unfinished-session continuation but reveals hidden cards to local inspection; this local experience makes no tamper-proof or competitive fairness claim.

The core returns meaning references and themes from explicit versioned rules. Localized prose and art stay in content packs. If LLM narration is added later, it consumes fixed results and referenced meanings; it cannot replace the draw.

## 10. Content, art, and privacy

Manifests describe asset ID, version, dimensions, anchor/atlas coordinates, color/filter policy, source/approval status, and license information. Image generation output is not presumed to be aligned animation or production-ready texture data.

Use the approved mature pixel-art direction. Preserve symbolism deliberately, including emotional backgrounds where relevant, without forcing every card into the same celestial palette. Distinguish art changes from meaning changes.

Start with a defined internal render resolution and nearest presentation; validate zoom and mobile readability. Use sprites for controlled facial changes, restrained mesh movement for body presentation, and mesh/shader/particle composition for the crystal interior. Actual chart positions are separate from decorative stars and constellations.

HTML owns readable text, forms, focus, and controls. Provide a useful WebGL failure path and reduced-motion behavior. Keep birth data and questions out of URL parameters, telemetry, and errors. Save only on explicit user action and support deletion; drafts may live in memory. External geocoding is optional and disclosed.

## 11. Validation and delivery gates

Scaffold gate: workspace manifests, ownership/import rules, ADRs, contract fixtures, honest local commands, and minimal Rust/TS smoke checks. No requirement to install browser automation before the web app exists.

Engine gate: native and WASM parity, reference fixtures, invalid input/error contracts, worker smoke execution, artifact sizes, and real browser qualification before claiming browser support. Tarot needs invariant/reference tests; astrology needs condition-aligned independent references and boundary tests.

Frontend gate: direct-route access, latest-navigation wins, history consistency, keyboard/focus behavior, reduced motion, failed asset/WASM retry, resumed sessions, and disposal verification. Network traces prove feature isolation. Browser tests exercise real adapters after engine qualification; Storybook mock providers remain visibly labeled.

Report separate compressed download, initialization, calculation, navigation/frame behavior, and memory measurements. Set budgets after the initial baseline.

## Storybook development boundary

Storybook is a separate local development entrypoint configured under apps/web/.storybook, with stories under apps/web/src/stories or beside shared components. The builder/framework adapter and versions are pinned after compatibility with the selected Next.js version is checked.

Stories import the same production components, scene entrypoints, and runtime harness; do not implement parallel scene logic. Decorators inject synthetic fixtures, mock worker clients, asset resolvers, container dimensions, and reduced-motion preferences. Each scene story owns a renderer lease or isolated runtime instance that is fully cleaned up on story switch, unmount, and hot reload; the single persistent renderer rule applies to the production Next.js app, not across Storybook iframes.

Cover oracle expressions, crystal idle/active/chart states, card back/upright/reversed/selected/revealed states, forms and reading panels, and isolated landing/astrology/tarot scenes. Use deterministic fixtures and an explicit freeze/reset mechanism for animated capture. No ordinary story initializes real WASM; opt-in real-engine integration stories must be labeled and load only the selected engine.

Storybook component/interaction/visual checks complement app tests. It does not prove actual App Router history, direct links, production lazy bundles, or browser engine support. Keep Storybook output and dependencies outside the production app bundle and use synthetic personal information only.

## 12. Decisions to capture as ADRs

| Decision | Baseline | Remaining work |
| --- | --- | --- |
| Workspace and framework | npm + Cargo, Next.js App Router | Pin compatible versions and static-export route strategy |
| Engine separation | Two cores and two WASM artifacts | Enforce import and artifact isolation |
| C astronomical backend | Astronomy Engine preferred | Compile/link/browser/accuracy spike and toolchain choice |
| Time conversion | Explicit historical timezone adapter | Dataset, coverage, ambiguity policy, and browser delivery |
| Rendering | Persistent renderer, three lazy scenes | Interface, camera transition, asset leases, reduced motion |
| Tarot RNG/session | Versioned permutation and saved actual results | Pin PRNG, reference vectors, schema migration |
| Storybook | Shared components and isolated scene harnesses | Compatible adapter/version, decorators, deterministic captures, and teardown |
| Content/art | Separate versioned packs and stable IDs | Authoring schema, approval and licensing workflow |

Every ADR records context, decision, alternatives, consequences, validation evidence, and supersession rules. Folder names are not sufficient boundary enforcement; add import checks and contract tests as implementations land.


## Implemented tarot choreography

See [ADR 002](docs/decisions/002-tarot-table-choreography.md) for the engine-confirmed controller, minimal `TarotView`, Mesh picking, hand anchors, camera transition, restoration, and texture lifetime contract. Frame coordinates remain scene-local; questions never enter scene or engine requests. The authored English reflection pack does not analyze questions.

See [ADR 003](docs/decisions/003-tarot-perspective-rig.md) for articulated arms, authored camera-view torso plates, PBR materials and Scene-owned selective pixel compositing. The optional render hook preserves runtime renderer ownership and existing scene isolation.

## Deterministic three-card interpretation

[ADR 004](docs/decisions/004-deterministic-free-readings.md) adds the independent pure Rust `pxoracle-tarot-reading` crate to the existing tarot WASM adapter. Its external symbolic packs are validated/cached in the Worker; English sentences remain a separate frontend content pack. Only three revealed cards and a fixed structured perspective enter interpretation. The original draw engine, position IDs, `en.v1`, Scene contracts, and astrology engine remain independent. Versioned v2 save envelopes preserve draw identity and require explicit perspective selection or version migration when needed.

[ADR 005](docs/decisions/005-exhaustive-reading-export.md) adds an offline exhaustive export of every three-card reading (43,819,776 rows). It reuses the production Rust interpreter (via the `reading-export` example) and the shared `composeReading`/`renderPhrase` formatter, stays out of CI and public assets, and is operated with `npm run reading-export` as described in [docs/reading-export.md](docs/reading-export.md).
