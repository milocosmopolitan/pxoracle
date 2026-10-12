# Consultation, presentation and shared desk contract

## Root state (apps/web/src/state/consultation.ts)

`ConsultationState` = `{ service, stage, presentation, revision, birthplace, draft, saved }`.
It never contains chart results, interpretation plans or scene coordinates.

| Intent | Effect |
| --- | --- |
| `arrive` | Hub at the table. No-op when already there. Data retained. |
| `service natal` / `horoscopes` | `greeting` / `horoscopes` stage at the table. |
| `hub` | Back to service choices; service cleared, data retained. |
| `saved` | Records the probe result; no revision change. |
| `explore-birthplace` | `birthplace` stage, globe presentation. |
| `confirm-birthplace` | Commits the confirmed place, `details` stage, table. |
| `cancel-birthplace` | Table; `details` if a place is confirmed, else `greeting`. Confirmed place untouched. |
| `draft` | Merges date/time/accuracy; no revision change. |
| `details` / `review` | Table stages; without a confirmed place they open the globe instead. |
| `use-saved` | Sets place and draft from a recorded input; `review` (or `details`) at the table, globe skipped. |
| `new-chart` | Clears draft and confirmed place only; globe presentation. Saved storage and the current chart stay. |
| `open-crystal` | Crystal presentation. Dispatched only on explicit user action and only when the revision captured at that action is unchanged after an asynchronous result. |
| `return` | Table presentation. From the crystal → `hub`; from the globe → `details`/`greeting`. Nothing is cleared. |

`revision` increments on stage/presentation changes only.

Store coupling: `navigateBirthplace(open|region|country)` also dispatches
`explore-birthplace`; `cancel`, or `back` reaching the room framing, dispatches
`cancel-birthplace`. `requestGlobeEntry` (landing globe click) sets a pending flag that
`Astrology` consumes instead of dispatching `arrive`.

## Derived scene views (apps/web/src/features/Astrology.tsx)

- `view = crystal` when presentation is crystal and a chart exists; `globe` when presentation is globe; otherwise `table`.
- `globeView.phase`: `room` (table), the birthplace browsing phase (globe; `room` is promoted to `overview`), `crystal` (crystal).
- `astrologyView.phase`: `chart` only in the crystal view; `entry` otherwise.
- `.natal-layout` exposes `data-presentation`, `data-stage`, `data-globe-phase` and `data-chart` for tests and styling.

The scene keeps its own interpolation, revisions and `onSettled` acknowledgments
(ADR 007/009). The table framing is the `room` shot of `globe-camera.ts`, now raised by
`0.16 × distance` so the real tabletop is visible.

## Saved-data probe (apps/web/src/features/astrology/savedProbe.ts)

`probeSaved(() => localStorage)` returns `{ availability, candidate }` where availability is
`none | current | legacy | input-only | unsupported | corrupt | unavailable`. It runs in a
client effect after hydration and again after explicit Save/Delete. It never calculates,
regenerates, migrates or writes. `candidate` (the parsed save) stays in component
memory for the greeting label and "Review saved details"; it is never placed in a URL,
log or request.

## Dialogue surface

`OracleBubble` is an HTML `section` (`aria-label="The oracle"`, `tabIndex=-1`, polite live
region) rendered in the stage column: absolutely positioned beside the oracle's head on
wide viewports, static below the stage under 800px, no animation under reduced motion.
It receives focus after each explicit stage or presentation change; otherwise the panel's
heading does. Every action is a real transition from the table above.

Escape: full report → exploration; selection → whole chart; crystal → table; globe → table.
A visible `Return to the table` control exists in the stage (globe and crystal) and in the
chart panel; it is distinct from the site-level `Back to the room` link.

## Shared desk (packages/scenes/src/study-table.ts)

`buildTableAssembly(parent, dims, wood, trim, owner)` adds `tabletop`, `table-front-apron`,
`table-back-apron`, two `table-side-apron` and four `table-leg` meshes (cast and receive
shadows) in table-local coordinates: x across, +y rear, +z up, top surface at z = 0.
`TAROT_TABLE` preserves the tarot numbers exactly. `STUDY_TABLE` is the painted rooms'
desk; `studyDesk(mode)` gives its world placement (`top`, `rear`, `front`, `center`,
`depth`, `width`, `scale`). `createStudyTable(leases, signal, mode)` returns a disposable
world-space group with its own geometries, materials and walnut lease.

Rooms: `studyLayers(mode)` stands painted sprites on `studyDesk(mode).top` at explicit
depths using their measured visible-bottom fractions, lays the mat flat
(`appearance.flat`), and lets `composition` drape the runner over the real front edge
(`options.desk`). `studyAnchors(mode)` places lamp, candle and globe on the same top.
The landing orthographic camera pitches 9°; the astrology map anchor sits just in front
of the painted crystal at `z = rear + 0.36 × depth + 0.03`. No tarot engine, card or hand
logic enters the landing; the landing still fetches no WASM or city shards.
