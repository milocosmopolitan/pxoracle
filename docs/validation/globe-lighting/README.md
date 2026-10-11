# Globe and prop lighting delivery evidence

Implemented on `feat/63-globe-prop-lighting` against main
`2482c84ef91fcc9643247493629ebb01f6c68ada`, inspected 2026-10-11.
The initial [issue bodies](issue-snapshot.json) are retained for scope review.
Subsequent user visual review on 2026-10-11 moved the globe to the user's right
outside the mat and replaced the candle body/holder sprite with original meshes;
the flame remains a sprite. Issues #73/#75 record that approved scope revision.
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
has a lined thick shade, bent bronze column and layered base. Following user visual
review, the candle has an original three-dimensional wax body and brass holder;
only its single flame uses the source sprite. Seeded smooth noise drives the
wick flame and actual shadowless PointLight. The globe now sits toward the user's
right outside the reading mat. A prop-owned warm SpotLight is
the main warm shadow source. Painted backgrounds, portraits and card faces retain
their existing unlit color policy. Mesh hands, table and props receive real light.

Architecture and privacy: [ADR009](../../decisions/009-globe-and-prop-lighting.md).
Scenes receive public region/country IDs and display state, not birth records,
search strings, cities or private coordinates. Synthetic inputs were used throughout.
Rust schemas and calculation semantics were unchanged; schema regeneration was not needed.

## Inspectable images and motion

- [Integrated room](room-integrated.png), [approach](globe-approach.png),
  [camera midpoint](globe-camera-midpoint.png), [completed camera approach](globe-camera-completed.png),
  [region](globe-region-asia.png), [Russia](globe-country-ru.png),
  [Singapore](globe-country-sg.png), [Fiji](globe-country-fj.png),
  [Iceland](globe-country-is.png), [city selection](globe-city-selected.png).
- [Original globe front](images/globe-front.png), [rear](images/globe-rear.png),
  [relief close-up](images/globe-terrain.png), [room detail tier](images/globe-room-quality.png).
- [Lamp front](lamp-front.png), [side](lamp-side.png), [rear](lamp-rear.png),
  [above/interior](lamp-above.png). Lighting A/B: [all sources](lamp-all-lights.png),
  [shade glow without prop lights](lamp-shade-only.png), [no lamp shadow](lamp-no-shadows.png).
- [Candle close](candle-close.png), [candle-only light](candle-only.png),
  [mesh front](candle-mesh-front.png), [mesh side](candle-mesh-side.png),
  [wax well and holder from above](candle-mesh-above.png),
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
- `npm test`: **90/90 passed** with the bounded presentation repair (27.44s), including geography alignment, state invalidation,
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
- Final natal camera Storybook checks: **8/8 passed in46.35s** using the rebuilt
  static Storybook. Seven normal-motion scenes and one reduced-motion scene retain
  all original controls, assertions and screenshots. Separating independent cases
  fixes the hosted run's aggregate240s timeout, which occurred after all assertions.
  [Results](natal-camera-story-results.json).
- The added production birthplace camera midpoint check passes **1/1 in10.3s**.
  It starts after the first actual room frame, then fixes camera progress at50%;
  globe orientation is explicitly settled. Two captures are pixel-identical and
  differ from the completed approach. This is a camera review frame, not a claim
  to freeze every animated object at half its trajectory.
  [Results](birthplace-midpoint-story-results.json).
- Two additional real-WASM browser regressions verified route remount and manual/atlas
  switching submit the displayed Seoul coordinates and provenance together.
  All **3/3** final Chrome checks passed, including actual room globe clicking after
  an existing saved chart with retained date/time and byte-identical saved storage.
  [Results](birthplace-regression-results.json).
- Source commit `a3b301b979e186cbb74a5bb167880826f7c314cd` passes CI's native/WASM,
  static build,90-test Node suite, Storybook build and actual macOS Safari smoke.
  [Workflow](https://github.com/milocosmopolitan/pxoracle/actions/runs/38173313664).
  That workflow passed Chrome, Firefox fallback, mobile emulation and25 Storybook
  checks; WebKit had29 passes,2 skips and one visibly stale keyboard-zoom frame.
  The public diagnostics showed revision acceptance and29 WebGL draws despite an
  unchanged image. The runtime now schedules one bounded follow-up presentation
  frame for on-demand updates, then returns to idle. Local WebKit passes3/3 with
 58 draws for zoom and no further draws over500ms. Fixed review frames also stop
  requesting unnecessary renders. [Regression evidence](webkit-keyboard-presentation.json).
  Hosted run [38175076210](https://github.com/milocosmopolitan/pxoracle/actions/runs/38175076210)
  on `4f2d167` confirms the keyboard/presentation repair, including the500ms idle
  assertion. Its separate fast-input HTML fallback test failed when a passive
  country reset erased newly typed text. The narrow layout-effect reset repair
  passes **6/6 local WebKit checks in13.4s**, three repeats each of fallback retry
  and country/manual invalidation. Hosted confirmation of that search repair is
  pending. [Diagnosis and raw hosted keyboard evidence](webkit-presentation-and-search.md).

A failed first attempt is recorded above rather than hidden. Subsequent targeted
reruns verify the repaired boundary; Node tests are not presented as browser coverage.
Latest browser capture records [zero page errors](capture-browser.json).

## Measured cost and optimization

[Full methods/raw results](performance.md), [JSON](performance.json).
The supplemental [region and HTML chooser probe](region-chooser-performance.json)
measures the previously missing stages: city selection preserves exact scene pixels,
camera revision and live resources, with zero new draws or geographic requests.
The selected Singapore shard is10,870 raw /4,283 gzip-equivalent bytes.
One persistent renderer completed seven overview→Fiji→tarot→room cycles with exactly
**218 live GL buffers** at every room return after the candle-mesh revision.
All4,826 buffers created in the Metal run were deleted on teardown; leases returned
to0 and the context was lost. An actual two-buffer-per-cycle InstancedMesh leak
was found and fixed. The flame now owns a clone of the shared Sprite geometry.
[Eight isolated globe cycles](globe-resources.json) independently exercise preparation
competition and return to an empty scene.

Final complete-frame draw calls with shadows: room63, overview40, Singapore30, tarot222. Lamp
shadows add8 calls in room/globe and27 across tarot's multiple passes. Default512²
shadow color/depth attachment payload is nominally2MiB, not measured driver memory.
Before the candle-mesh revision, room/tarot fixed LOD reduced submitted triangles
by approximately71%; that historical percentage is not the final mesh delta. Detailed country
relief remains360×180. Room-only globe assets total1,058,875raw bytes, country tier
5,323,448raw bytes. Exact gzip9 sizes and exclusions are in the measurement report.

The software measurements used headless Chromium141,1280×720,DPR1, ANGLE SwiftShader.
Software rasterization exhibits substantial backpressure and is not a hardware FPS
claim. No GPU timer extension was available. Exact final submission timings and
resource counts are in the raw reports. The historical baseline restores only tarot
source with current shared runtime, so it is an approximate comparison, not a
pristine historical build.

The separate [Apple M4 Metal measurement](performance-hardware.json) uses actual
desktop GPU execution queries: room/overview/Singapore/tarot GPU p95 was
**1.884/3.722/3.930/6.983ms**, with60 valid samples per view and nearest-rank p95.
Tarot exceeds the provisional4ms target. The earlier12-sample result understated
the longer measurement and is retained as historical evidence, not a passing result.
The two-pass half-float glow filter reduced tarot p95 from9.106ms in the preceding
full measurement. A paired A/B independently confirms lower GPU cost and at most
1/255 image rounding outside the intentionally removed duplicate flame halo.
Its two640×360 RGBA16F targets add3,686,400 nominal bytes at this viewport. Browsers
without renderable float attachments retain the original filter; forced fallback
matches its reading/detail pixels exactly. See [A/B evidence](blur-ab.json) and
[fallback evidence](blur-fallback-ab.json).
These results qualify the documented desktop fixture, not physical mobile or thermal
behavior. Software rasterizers automatically disable only the lamp shadow;
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
  lossless import process retained. The flame shares the existing texture; the body
  and holder use original procedural geometry and painterly materials.
- Existing GeoNames atlas covers34,159 cities/244 country-territory entries. Boundaries
  cover234 entries; BQ,CC,CX,GF,GI,GP,MQ,RE,SJ,YT remain selectable by list without an
  invented polygon. The UI explains unavailable boundaries. Region memberships are
  browsing policy, including explicit Middle East and cross-region membership.
- Elevation source is sampled at1/3°; it supports country-scale relief, not survey,
  street or city terrain. Small islands rely on highlighting/list selection and a
  maximum camera magnification. Manual entry covers atlas gaps with explicit IANA zone.

## Issue disposition

Implementation map, with final issue disposition pending the current PR checks:

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

Both epics are implemented, including the subsequent placement and candle-mesh revision.
The implementation map is subject to the latest PR workflow and issue comments.
The `4f2d167` workflow confirms the WebKit presentation repair but exposed a separate
fast-input fallback regression. Its country-reset repair has local6/6 WebKit evidence
and awaits hosted confirmation; see the linked diagnosis above. Verification issues and parent epics stay open until required
gates pass. The measured tarot fixture exceeds the internally chosen provisional4ms
GPU p95 goal; that goal is not an original numeric issue acceptance criterion and
is retained as an explicit performance limitation, never represented as passing.
No result here qualifies a physical mobile device or sustained thermal performance.
Native Safari results must be read from the PR workflow, not inferred from WebKit.
The desktop budget and software fallback are scoped to the documented measured
fixtures; broad device support remains a stated product limit, not a passing claim.
