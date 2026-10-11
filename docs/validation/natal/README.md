# Natal delivery and qualification, epic #38

Implementation: city choice → local calculation → same-room crystal approach →
body/relationship selection → deterministic overview/full HTML report → explicit
save, restore and delete. No remote interpretation or birth-record upload is added.
Next.js remains a static export. The separate tarot engine, reading and scene are
preserved, including the later main integration of reading-export PR #60.

## Evidence and reproduction

- [Completed HTML report](evidence/completed-report.html), synthetic Seoul,
  2000-01-01 12:00 Asia/Seoul. This is actual production report markup, not a mockup.
- [Desktop entry](evidence/desktop-entry.png),
  [intermediate approach](evidence/desktop-approach-mid.png),
  [overview](evidence/desktop-overview.png), [detail](evidence/desktop-moon.png).
- [Mobile overview](evidence/mobile-overview.png),
  [mobile detail](evidence/mobile-moon.png).
- [Desktop sequence](evidence/desktop-sequence.webm) and
  [mobile sequence](evidence/mobile-sequence.webm), normal-motion Chrome captures
  at 1355×900 and 390×844. The room/crystal persist in intermediate frames.
- [Editorial review](editorial-review.md),
  [architecture/versions](../../decisions/007-local-natal-readings.md),
  [scene contract](../../contracts/natal-scene.md),
  [original content/rules](../../../content/astrology/natal/README.md),
  [atlas attribution](../../../content/astrology/atlas/README.md).

Run the development app on a free port, then
`node scripts/capture-natal.mjs http://localhost:3018` to reproduce the synthetic
flow, screenshots, video and HTML example. Ordinary Storybook examples are labeled
synthetic native fixtures with mock transport; actual browser tests use real WASM.
The captures use desktop browsers and viewport/device emulation, not physical phones.

## Verification ledger

After integration with main PR #60, 33 native tests and 61 Node tests pass, alongside
Emscripten WASM builds, TypeScript, schema regeneration, ownership checks and static
Next export. The Storybook build also passes. Native/WASM plans match exactly
for nine fixtures; floating chart values use the established 1e-8° tolerance.
All 252 placements and 214 witnessed aspect keys are selectable, and every one of
493 sentence references resolves. Worker tests check concurrent installation,
version mismatch, corrupted pack hashes and successful same-input retry.

Real browser tests cover city aliases/duplicates, progressive DST fold/gap, unknown
time, same-chart content retry, supported/legacy restore, explicit regeneration of
inconsistent saved plans, deletion and route abandonment/resumption. Canvas tests
wait for actual camera readiness, then exercise body/line raycasting, drag rejection
and background return. Keyboard/HTML controls use the same selection state.

Local post-integration natal browser suite: **32 passed**, eight each in installed
Chrome, bundled Firefox, bundled WebKit and Pixel 7 Chromium emulation. This includes
the quick select/Escape readiness regression. The full Storybook suite passed 18
checks, including existing tarot cameras/rig, reading states and HMR cleanup.
[Browser versions](browser-versions.json) record the actual local engines.

[PR #61 checks](https://github.com/milocosmopolitan/pxoracle/pull/61/checks) provide the
final commit's hosted full regression results and downloadable artifacts, including
actual Safari via WebDriver on macOS. Local Safari remote automation was disabled,
so no local Safari success is claimed. The PR remains draft until its hosted gates
pass; a pending run is never counted as completed qualification.

## Download and lazy-loading boundaries

Measured raw / gzip-equivalent bytes, using Python gzip with mtime 0:

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| Astrology WASM | 1,539,686 | 359,216 |
| Symbolic semantics + rules | 97,718 | 7,173 |
| English prose | 379,619 | 79,316 |
| Natal manifest | 688 | 336 |

The JS engine loader is 17,762 raw / 5,090 gzip bytes. Against the deployed main
artifact from PR #59, astrology WASM grows by 366,959 raw / 91,798 gzip bytes. This
comparison spans Linux/macOS builds; it is not a controlled compiler-size benchmark.
See `sizes.json`. Gzip-equivalent size is not a claim that a plain local HTTP server
actually compresses the response. Existing artwork remains the main visual payload.

Atlas: US 1,191,115 raw / 429,314 gzip bytes, Korea 32,536 / 12,067. No world atlas is
downloaded. A country shard is fetched after its explicit selection, cached for
in-page offline search and retried after failure. Landing/tarot request no atlas,
natal pack or astrology WASM. Astrology requests no tarot WASM. Engine initialization
starts only on calculation/restore. Symbolic packs install once per Worker/version;
prose is fetched separately and successful page-module loads are reused.

## Scope and compatibility limits

City search covers the source's **3,408 US and 147 South Korean records**, not every
settlement or worldwide coverage. Missing, renamed and border locations retain a
manual coordinate/IANA path. GeoNames supplies modern representative point/zone
assignments under CC BY 4.0; historical civil offsets come from embedded IANA 2025b,
with pre-1970 limitations disclosed. No polygon timezone lookup is claimed.

Calculation remains apparent tropical/geocentric/Whole Sign, 1900–2100, with the
existing UTC-as-UT1 and backend delta-T policy. Approximate/unknown time uses midpoint
and 15-minute samples, not certified interval bounds; ASC/houses/aspects are omitted.
Exact charts at |latitude| ≥66° omit ASC/houses while retaining planetary aspects.

Content is English, with 214 witnessed pair/aspect treatments and two visibly labeled
pair-level fallbacks. Agent editorial review and coverage tests are not independent
human approval. There is no separate retrograde interpretation, prediction, diagnosis
or objective personality score. Physical mobile devices and hardware GPU budgets are
not qualified by browser emulation.

New saves use `pxoracle.natal-report.v1`; both legacy keys remain readable. Valid
legacy facts require explicit new interpretation, and unavailable fact versions require
explicit recalculation. Save alone replaces the current envelope; Delete removes all
three documented keys. A load or interpretation failure does not change the chart.

## Issue-to-evidence map

- #39: ADR 007, generated natal DTO schemas/TS, pure-crate boundary check.
- #40–#41: retained GeoNames source/provenance, reproducible country shards,
  atlas tests, real city/DST/manual/unknown input browser flows.
- #42: strict saved-chart validation, historical/polar/boundary tests, preserved
  independent astronomical reference fixtures and uncertainty capability matrix.
- #43–#44: authored packs, aspect witnesses, pure evaluator tests and prose review.
- #45: independent lazy client/Worker, integrity/cache tests, native/WASM parity.
- #46–#47: shared intent contract, camera stories, raycasting tests, full report,
  intermediate frames and sequence videos.
- #48: versioned envelope, current/legacy/inconsistent save and deletion tests.
- #49: six repository gates, browser/Storybook regression suite, this evidence record.

## Earlier deployment completed

Before this epic, PR #50 and the OIDC/hydration follow-up #59 were merged and deployed
using `AWS_PROFILE=milo`, us-east-1. The manual
[Publish run 38145221654](https://github.com/milocosmopolitan/pxoracle/actions/runs/38145221654)
succeeded, serving main `6d57488` at
[CloudFront](https://d2zqxem1cx5v8m.cloudfront.net). This natal PR is a separate review
step; its creation does not deploy the new natal experience automatically.
