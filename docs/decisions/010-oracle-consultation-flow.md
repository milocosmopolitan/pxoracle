# ADR 010: Oracle-led consultation flow and the shared study desk

Status: implemented for #81 and #82–#88 on `feat/82-consultation-flow`, baseline main
`f074088b78796bfc1fbff8d9bf0b2eb4208435d2`. Validation evidence lives in
[docs/validation/consultation](../validation/consultation/README.md).

## Context

ADR 009 made the birthplace globe the first thing `/astrology/` showed and let a
non-null chart select the crystal camera. Opening the route therefore started inside
a tool rather than with the oracle, and returning to the room view meant discarding
the chart (`controller.edit()` called `setChart(null)`). The landing composition also
drew a thin lit box behind the painted desk; under the orthographic camera it rendered
edge-on as a brown seam across the tabletop (#81).

## Decision

### One study desk

`packages/scenes/src/study-table.ts` owns the table assembly that the tarot scene
already used: a rounded tabletop, four aprons and four legs built from a
`TableDimensions` record, with a `TableSurface` colour policy over the shared walnut
albedo. The tarot scene calls `buildTableAssembly` with its unchanged numbers
(`TAROT_TABLE`, cool `TAROT_TABLE_SURFACE`) inside its own rotated table group, so its
geometry, camera, hands and cards are untouched. The landing and astrology rooms place
the same assembly with `STUDY_TABLE` dimensions at `studyDesk(mode)`: top surface
`y = -0.82`, rear edge `z = 0.4`, 0.78 scale in the landing's pulled-back furniture.
The painted `table.webp` layer and the thin `study-light-responsive-desk` slab are
removed from every room. Painted tabletop objects stand on the real surface at
measured alpha-bound contact points, the reading mat lies flat on it, the runner is
draped over the real front edge, and props use `studyAnchors(mode)` on the same top.
The landing orthographic camera pitches down 9° (frustum height scaled by `cos`, so
billboards keep their painted size) and the astrology room shot rises by
`0.16 × distance`, so the tabletop reads as a surface in both rooms.

### Consultation state

`apps/web/src/state/consultation.ts` is a pure reducer owned by the root Zustand
provider and kept apart from chart data:

- `service`: `natal`, `horoscopes` or none.
- `stage`: `hub`, `horoscopes`, `greeting`, `birthplace`, `details`, `review`.
- `presentation`: `consultation`, `globe` or `crystal`. This alone selects the camera.
  `chart !== null` never does.
- `birthplace`: the explicitly confirmed place (label, IANA zone, coordinates,
  provenance). Browsing a candidate on the globe never changes it.
- `draft`: date, accuracy, time and uncertainty entered at the table.
- `saved`: the read-only probe result (`none`, `current`, `legacy`, `input-only`,
  `unsupported`, `corrupt`, `unavailable`).
- `revision`: incremented by every stage or presentation change, never by typing or
  probing. Asynchronous completions (calculation, restore) compare it and update data
  only; they never change presentation after the reader has moved on.

Intents: `arrive`, `service`, `hub`, `saved`, `explore-birthplace`,
`confirm-birthplace`, `cancel-birthplace`, `draft`, `details`, `review`,
`use-saved`, `new-chart`, `open-crystal`, `return`. The store's `navigateBirthplace`
wrapper owns the coupling: `open`/`region`/`country` enter the globe presentation,
`cancel` or backing out of the overview returns to the table. The landing globe is an
explicit shortcut (`requestGlobeEntry`) that keeps chart, draft and confirmed place.

### Views and cameras

`globeView.phase` is derived from presentation: `room` at the table, the browsing
phase in the globe, `crystal` in the crystal. `astrologyView.phase` is `chart` only in
the crystal presentation with a chart. Per-frame interpolation stays inside the scene.
Returning to the table is presentation navigation: `return` keeps chart, interpretation,
draft, confirmed place and saved storage, and lands on the hub (from the crystal) or on
details/greeting (from the globe). Escape is layered in one handler: report → exploration
→ whole chart → table; globe → table. Browser history stays route history.

### Dialogue

The oracle speaks through `OracleBubble`, a readable HTML section with real buttons
beside her portrait (static below the stage on narrow viewports, no animation under
reduced motion, focused after each explicit stage change). Entry, reload and in-app
reentry begin at the hub with `Natal Chart` and `Horoscopes`. Horoscopes is a separate
branch with an honest availability notice; it never touches the globe, atlas, engine or
interpretation packs. Natal Chart greets according to the saved-data probe, which reads
storage once, never calculates, regenerates, migrates or writes, and distinguishes an
unsaved current chart ("resume") from a persisted save. New chart → globe (region →
country → city list, camera fixed during city choice) → explicit `Confirm birthplace` →
table with the coordinates/zone retained → date/time/accuracy → summary → explicit
`Calculate and enter the crystal`. Saved details are reviewed at the table without the
globe. Existing fold/gap prompts, unknown/approximate time policy, manual coordinates,
explicit Save/Delete, legacy and unsupported handling are preserved.

## Alternatives

Keeping a chart-driven camera with a "back" flag was rejected: it still let late
results steal the view. Rendering the bubble as a sprite was rejected for readability and
screen readers. A separate landing 3D desk was rejected in favour of one assembly, so
the tarot and painted rooms cannot drift apart again.

## Consequences

`BirthForm` is split into `BirthplaceForm` (globe, country, city, manual coordinates,
confirm/cancel) and `BirthDetailsForm` (date, accuracy, time) with `BirthReview` at the
table. `controller.edit()` is gone. Tests and the Safari smoke script follow the new
flow. No Rust, WASM, schema, atlas or saved-format change. No horoscope engine, server
interpretation or authentication is added. Scene contracts are in
[docs/contracts/consultation.md](../contracts/consultation.md).
