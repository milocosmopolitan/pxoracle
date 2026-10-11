# Globe and prop lighting delivery evidence

Implemented on `feat/63-globe-prop-lighting` against main
`2482c84ef91fcc9643247493629ebb01f6c68ada`, inspected 2026-10-11.
The current [issue bodies](issue-snapshot.json) are retained for scope review.
No merge or production deployment was performed.

## Delivered behavior

The room globe opens birthplace exploration, including when a chart already exists.
The same scene anchor supports region/country travel, north-up geographic rotation,
limited country magnification and bounded drag/keyboard adjustment. Selecting a city
changes the root candidate only: it does not change globe rotation, camera position,
target or projection. The real country atlas loads only after country selection;
its cache retains at most four country shards. The previous manual coordinate/IANA
zone flow and explicit chart save/delete remain available.

The original globe has actual ETOPO1-derived vertex displacement plus bump detail,
independent sphere rotation, engraved brass mount and turned walnut base. The lamp
has a lined thick shade, bent bronze column and layered base. The original candle
plate is split into complementary body/flame layers; seeded smooth noise drives the
single wick flame and actual shadowless PointLight. A prop-owned warm SpotLight is
the main warm shadow source. Painted backgrounds, portraits and card faces retain
their existing unlit color policy. Mesh hands, table and props receive real light.

Architecture and privacy: [ADR009](../../decisions/009-globe-and-prop-lighting.md).
Scenes receive public region/country IDs and display state, not birth records,
search strings, cities or private coordinates. Synthetic inputs were used throughout.
Rust schemas and calculation semantics were unchanged; schema regeneration was not needed.

## Inspectable images and motion

- [Integrated room](room-integrated.png), [approach](globe-approach.png),
  [region](globe-region-asia.png), [Russia](globe-country-ru.png),
  [Singapore](globe-country-sg.png), [Fiji](globe-country-fj.png),
  [Iceland](globe-country-is.png), [city selection](globe-city-selected.png).
- [Original globe front](images/globe-front.png), [rear](images/globe-rear.png),
  [relief close-up](images/globe-terrain.png), [room detail tier](images/globe-room-quality.png).
- [Lamp front](lamp-front.png), [side](lamp-side.png), [rear](lamp-rear.png),
  [above/interior](lamp-above.png). Lighting A/B: [all sources](lamp-all-lights.png),
  [shade glow without prop lights](lamp-shade-only.png), [no lamp shadow](lamp-no-shadows.png).
- [Candle close](candle-close.png), [candle-only light](candle-only.png),
  [stable reduced motion](lighting-reduced-motion.png),
  [injected failure](lighting-asset-failure.png), [retry](lighting-asset-retry.png).
- [Tarot conversation](tarot-lighting-conversation.png), [table view](tarot-lighting-table.png),
  [390×844 touch viewport](globe-mobile-emulation.png), explicitly emulation.
- Videos: [forward/back birthplace flow](globe-forward-back.webm),
  [candle flame and illumination](candle-animation.webm),
  [tarot camera approach and return](tarot-camera-lighting.webm).
- [Before city selection](city-camera-before.png) and [after](city-camera-after.png)
  are exact matching reduced-motion stage pixels in the browser regression.

These are actual browser renders of production factories. Storybook input/transport
fixtures are explicitly labeled synthetic; production app regressions calculate with
real WASM. Visual inspection led to fixes for obscured flame ordering, overly dark
materials, thick table geometry, overlapping labels and upside-down Fiji framing.
The final images were inspected directly, not inferred from passing Node tests.

## Checks performed

- `cargo test --locked`: passed, 35 tests across 19 suites reported by RTK.
- `npm run wasm`: passed with repository-pinned Emscripten4.0.10. The workstation's
  6.0.12 installation failed linking; an isolated4.0.10 installation was used without
  changing the shared SDK. Native/WASM parity passes in the Node suite.
- `npm run typecheck`, `npm run build`, `npm run build-storybook`: passed.
  Next output contains static `/`, `/astrology/`, `/tarot/` and404 routes.
- `npm test`: **88/88 passed**, including geography alignment, state invalidation,
  exact city-camera invariance, lamp/candle cleanup and existing native/WASM/saves.
- `node scripts/check-boundaries.mjs` and `git diff --check`: passed.
- Globe functional suite: **20/20** across desktop Chrome, Firefox, Playwright WebKit
  and mobile Chromium emulation; actual raycast parity adds **4/4**.
  [Functional JSON](globe-browser-results.json), [raycast JSON](globe-raycast-browser-results.json).
- Existing natal suite: **9/9 Chrome**, real chart calculation, save/restore, DST,
  privacy and abandonment. [Results](natal-browser-results.json).
- Existing app/reading/tarot/fallback Chrome run: **13/14 initially**, with the allocation
  test running against a stale build before the instance-buffer fix. The unchanged
  seven-cycle allocation assertion passed against the final build (**1/1**,54.3s); the final capability-policy build also passed (**1/1**,13.2s).
  The other13 passed, including real tarot reveal/retry/restore, normal-motion camera,
  pointer picking and DOM fallback.
- Existing Storybook suites: **3/4 initially**; HMR failed because Vite selected the
  native watcher before applying environment polling. Explicit opt-in watcher config
  fixed it; the unchanged three-edit listener check passed (**1/1**,16.7s).
- Two additional real-WASM browser regressions verified route remount and manual/atlas
  switching submit the displayed Seoul coordinates and provenance together.
  All **3/3** final Chrome checks passed, including actual room globe clicking after
  an existing saved chart with retained date/time and byte-identical saved storage.
  [Results](birthplace-regression-results.json).

A failed first attempt is recorded above rather than hidden. Subsequent targeted
reruns verify the repaired boundary; Node tests are not presented as browser coverage.
Latest browser capture records [zero page errors](capture-browser.json).

## Measured cost and optimization

[Full methods/raw results](performance.md), [JSON](performance.json).
One persistent renderer completed seven overview→Fiji→tarot→room cycles with exactly
**204 live GL buffers,29 textures,4 framebuffers,22 programs** at every return.
All4,889 created buffers were deleted on teardown; leases returned to0 and the
context was lost. An actual two-buffer-per-cycle InstancedMesh leak was found and fixed.
[Eight isolated globe cycles](globe-resources.json) independently exercise preparation
competition and return to an empty scene.

Final complete-frame draw calls: room61, overview37, Singapore29, tarot250. Lamp
shadows add8 calls in room/globe and27 across tarot's multiple passes. Default512²
shadow color/depth attachment payload is nominally2MiB, not measured driver memory.
Room/tarot fixed LOD reduced submitted triangles by approximately71%; detailed country
relief remains360×180. Room-only globe assets total1,058,875raw bytes, country tier
5,323,448raw bytes. Exact gzip9 sizes and exclusions are in the measurement report.

The software measurements used headless Chromium141,1280×720,DPR1, ANGLE SwiftShader. Tarot submission median316ms/p95782.6ms is a serious software-renderer
limitation, not a hardware FPS claim. No GPU timer extension was available. Baseline
comparison restores only historical tarot source with current shared runtime, so it
is explicitly an approximate comparison, not a pristine historical build.

The separate [Apple M4 Metal measurement](performance-hardware.json) uses actual
desktop GPU execution queries: room/overview/Singapore/tarot GPU p95 was
2.157/1.150/2.860/2.293ms (12 valid samples per view). CPU submission p95 was at
most3.4ms. All seven cycles retained204buffers; teardown released all4,732buffers
and every lease. This qualifies that desktop fixture, not physical mobile or thermal
behavior. Software rasterizers now automatically disable only the lamp shadow;
other illumination and artwork remain. [Default-policy browser evidence](quality-policy.json) verifies all three routes on both backends. Unknown hardware keeps the bounded512²
default when texture capability permits it. No renderer identity leaves the client.

## Asset provenance and geographic limits

- [Globe provenance/pipeline](../../assets/globe.md): original procedural assembly and
  authored map treatment; NOAA ETOPO1 elevation and Natural Earth5.1.2 public-domain
  boundaries. Source subsets, conversion code and source/derived SHA-256 manifest are
  checked in. CGTrader was design reference only; no purchase or extraction.
- [Lamp provenance](../../assets/lamp.md): recovered project original matches the
  existing manifest SHA-256; durable original/runtime copies and procedural generation
  manifest retained. Exact filename `Aged bronze desk lamp(1).png` was unavailable.
  The verified original was `Aged bronze desk lamp.png`; no claim is made that an
  unavailable alternate attachment was inspected. Geometry/textures are newly authored.
- [Candle provenance](../../assets/candle.md): existing original/runtime hashes and
  lossless import process retained. Runtime separation shares the existing texture.
- Existing GeoNames atlas covers34,159 cities/244 country-territory entries. Boundaries
  cover234 entries; BQ,CC,CX,GF,GI,GP,MQ,RE,SJ,YT remain selectable by list without an
  invented polygon. The UI explains unavailable boundaries. Region memberships are
  browsing policy, including explicit Middle East and cross-region membership.
- Elevation source is sampled at1/3°; it supports country-scale relief, not survey,
  street or city terrain. Small islands rely on highlighting/list selection and a
  maximum camera magnification. Manual entry covers atlas gaps with explicit IANA zone.

## Issue disposition

Implemented and locally verified, with source/evidence linked in each GitHub issue:

- #64 contracts/state: `globe-view.ts`, `state/birthplace.ts`, ADR009, navigation tests.
- #65 data: `scripts/build-globe.py`, retained ETOPO1/Natural Earth source/manifests.
- #66 original model: `scenes/src/globe/`, front/side/rear production captures.
- #67 relief/materials: real displaced vertices, bump maps, close-up and lighting A/B.
- #68 scene integration: landing/astrology/shared props, lifecycle/browser regressions.
- #69 camera: `globe-camera.ts`, bounded north-up RU/SG/FJ/island frames and input tests.
- #70 atlas/form: root candidate, four-shard cache, stationary city frame, real saved data.
- #74 anchors/ownership: `study-props.ts`, ADR009, transformed anchor tests.
- #75 candle: `props/candle.ts`, synchronized signal, isolation/reduced-motion captures.
- #76 lamp mesh: `props/lamp.ts`, lined assembly, durable verified original, four views.
- #77 actual light:512² SpotLight, shadowless fill, `setShadows(false)` fallback and A/B.
- #78 shared integration: old warm lights removed, art policy retained, tarot video.

- #71 optimization: fixed room/country tiers, bounded atlas cache, actual M4 GPU
  and software measurements, explicit shadow fallback and seven-cycle raw GL counts.
- #72 globe qualification: local gates, four-browser flow/picking evidence, real input
  regression tests and current source/coordinate/atlas limitations.
- #79 lighting qualification: four-sided mesh inspection, source isolation A/B,
  camera videos, reduced motion and actual GPU/shadow/lifecycle measurements.

Implementation and local qualification are complete for both epics. GitHub CI must
be checked on the PR commit before closing the verification issues and parent epics.
No result here qualifies a physical mobile device or sustained thermal performance.
Native Safari results must be read from the PR workflow, not inferred from WebKit.
The desktop budget and software fallback are scoped to the documented measured
fixtures; broad device support remains a stated product limit, not a passing claim.
