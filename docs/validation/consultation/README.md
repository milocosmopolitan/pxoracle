# Oracle consultation flow and shared study desk — delivery evidence

Implemented on `feat/82-consultation-flow` against main
`f074088b78796bfc1fbff8d9bf0b2eb4208435d2` (PR #80), 2026-10-11.
Covers #81 (landing desk seam) and the #82 epic children #83–#88.
No merge or deployment was performed. All birth input is synthetic (Seoul, 2000-01-01
12:00 and the committed natal fixture); nothing personal entered URLs, logs or requests.

## #81 — one desk, no seam

Root cause, reproduced in Chrome at 1440×900 and 390×844 before the fix: the landing
scene added a thin lit `BoxGeometry(9, 0.045, 3.4)` (`study-light-responsive-desk`) at
`y = -1.025` behind the painted `table.webp`. Under the landing's orthographic camera the
box was seen edge-on, so its lit top face rendered as a brown band across the painted
desk, crossing the lamp base and extending past both table ends. In the astrology room's
perspective view the same box showed as a second, brighter tabletop strip behind the
painted edge.

Fix: the tarot table assembly was extracted to `packages/scenes/src/study-table.ts`
(`buildTableAssembly`, `TAROT_TABLE`, `STUDY_TABLE`, `studyDesk`, `createStudyTable`).
Tarot builds exactly the same meshes from `TAROT_TABLE` with its own cool wood policy;
the landing and astrology rooms place the same assembly at `studyDesk(mode)` and drop the
painted desk layer and the slab. Painted tabletop objects stand on the real surface at
measured alpha-bound contact points, the mat lies flat, the runner drapes over the real
front edge, and lamp/candle/globe use `studyAnchors(mode)` on the same top. The landing
camera pitches 9° (billboards keep their painted size), the astrology room shot rises by
`0.16 × distance`. No tarot engine, card or hand code enters the landing; the landing
still fetches no WASM or city shards (checked by `app.spec.ts` and `consultation.spec.ts`).

- Before: [desktop room](landing-before-desktop.png), [desk close-up](landing-before-desk-closeup.png),
  [mobile](landing-before-mobile.png), [astrology room](astrology-before-desktop.png).
- After: [desktop room](landing-after-desktop.png), [desk close-up](landing-after-desk-closeup.png),
  [mobile](landing-after-mobile.png); astrology room in the journey frames below.
- Tarot table unchanged: the tarot scene node tests (`tarot-scene.test.mjs`, 10) and the
  production tarot browser/Storybook checks listed under *Checks performed* pass; the
  table group, materials, camera, hands and cards were not edited beyond the shared
  builder call.

Inspection notes (desktop, Apple M4 Chrome): one continuous tabletop, aprons and legs;
crystal, mug, tray/deck, candle and globe grounded on the surface; the runner falls
from the mat's front edge and no longer covers the crystal base; the skirt stays behind
the real desk and shows between the legs; no horizontal slicing at either aspect ratio.

## #82–#88 — table-first consultation

Behaviour is specified in [ADR 010](../../decisions/010-oracle-consultation-flow.md)
and [docs/contracts/consultation.md](../../contracts/consultation.md).

- Entry, reload and in-app reentry begin at the consultation table with the oracle's
  bubble and exactly two choices, Natal Chart and Horoscopes. No birth form, globe or
  crystal focus; no engine, atlas or interpretation-pack requests before a choice.
- Horoscopes shows an honest "Not ready yet" notice with a way back and never opens
  the globe or the engine.
- Natal Chart greets by the read-only saved-data probe: none, current, legacy,
  input-only, unsupported, corrupt, storage unavailable. Opening a saved chart never
  passes through a globe phase; storage stays byte-identical.
- New chart: globe opens only after "Begin a new chart"; region → country camera,
  city list with the camera fixed; "Confirm birthplace" returns to the table with
  coordinates and IANA zone retained and no engine request; date/time/accuracy and the
  summary continue at the table; "Calculate and enter the crystal" is explicit.
- Return to the table from globe, crystal, detail and report keeps chart,
  interpretation, draft, confirmed place and storage; resume is explicit; a late
  calculation after returning updates data only and does not reopen the crystal.
- Escape: report → exploration → whole chart → table; globe → table. Focus lands on the
  bubble after each explicit stage change.

### Journeys (synthetic input, actual static export, Chrome)

Recorded by `scripts/capture-consultation.mjs` against the static export:

1. Consultation → Natal Chart → new chart → globe → Korea → Seoul → confirm → table →
   date/time → review → crystal → return → resume:
   [desktop video](videos/desktop-new-chart-journey.webm), [mobile video](videos/mobile-new-chart-journey.webm).
2. Consultation → saved chart → open without the globe → return:
   [desktop video](videos/desktop-saved-chart-journey.webm), [mobile video](videos/mobile-saved-chart-journey.webm).

Key frames (desktop): [hub](desktop-01-consultation-hub.png), [greeting](desktop-02-natal-greeting-no-save.png),
[globe approach mid-frame](desktop-03-globe-approach-1.png), [country](desktop-04-country-korea-1.png),
[city selected, camera fixed](desktop-05-city-selected-camera-fixed.png),
[return mid-frame](desktop-06-return-to-table-1.png), [details](desktop-07-birth-details.png),
[review](desktop-08-review.png), [crystal approach mid-frame](desktop-09-crystal-approach-1.png),
[interpretation](desktop-10-crystal-interpretation.png), [return from crystal mid-frame](desktop-11-return-from-crystal-1.png),
[resumed](desktop-12-resumed-chart.png), [saved greeting](desktop-21-greeting-saved-chart.png),
[saved crystal](desktop-22-saved-crystal-1.png). Mobile frames use the same names with the `mobile-` prefix.

## Checks performed

All on the final branch head, Apple M4 Chrome, static export served by `python3 -m http.server`
([`checks.json`](checks.json)):

| Check | Result |
| --- | --- |
| `cargo test --locked` | 35 pass (no Rust changes) |
| `npm run typecheck`, `npm run build`, `npm run build-storybook` | pass |
| `npm test` | 98/98, including `tests/consultation.test.mjs` (reducer transitions, revision policy, input assembly, store wiring, saved-data probe branches without writes) |
| `node scripts/check-boundaries.mjs` | pass |
| `npx playwright test --project=chrome` | 41/41 (real WASM): new `consultation.spec.ts` (9) plus migrated app, natal, birthplace-regression and globe-lighting suites, tarot table/fallback/reading unchanged |
| `npx playwright test --config playwright.storybook.config.ts` | 27/27, including `tests/storybook/consultation.spec.ts` (hub, every saved branch, unsaved resume, details, review, crystal return, mobile) |
| `scripts/capture-consultation.mjs` | both journeys at desktop and 390×844; zero page errors |

What the browser tests prove, by criterion: no engine/atlas/content request before a service
choice; Horoscopes never opens the globe; saved-chart open sees no globe phase and leaves
storage byte-identical; legacy/input-only/unsupported/corrupt/unavailable greetings never
write; city choice keeps the camera revision and the reduced-motion stage pixels
(`globe-lighting.spec.ts`); confirmation returns to the table with no engine request; a late
calculation after returning stays at the table; globe exit before a country, after a city and
by Escape keeps the confirmed place; return/resume keeps identical planet text; the landing
globe shortcut keeps chart and details; no WebGL fallback keeps the flow usable; the landing
fetches no WASM; seven navigation cycles keep the GL allocation baseline (`app.spec.ts`).

## Scope and limits

- Chrome (channel `chrome`) on an Apple M4 is the browser qualified here; the existing
  Firefox, WebKit and mobile-emulation projects were not rerun locally for the whole
  suite. Physical mobile and screen-reader audits remain manual gates.
- Storybook stories use a labeled synthetic storage seed and a mock chart transport;
  production browser tests use the real WASM engine.
- Horoscopes has no engine or content; the notice is the only behaviour.
- `npm run wasm` was not rerun: no Rust or C source changed in this branch; the
  committed engine artifacts are unchanged.
