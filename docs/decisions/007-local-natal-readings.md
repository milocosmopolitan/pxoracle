# ADR 007: Browser-local natal reports

Status: implemented for #38–#49, pending PR review. Qualification evidence is in
[the natal validation record](../validation/natal/README.md).

## Integration and ownership

Base: main `1a58f4c`, preserving reading-export PR #60 alongside the accepted tarot scene/reading and manual deployment, immutable OIDC and birth-form hydration fixes.
User edits in the original worktree remain separate. No tarot DTO, hand, camera,
artwork or interpretation rule is repurposed for astrology.

The calculation crate owns historical conversion, ten apparent geocentric tropical
longitudes, signed speed, inclusive major-aspect orbs and Whole Sign houses. A
separate pure `pxoracle-natal-reading` crate consumes a bounded projection of chart
facts. It has no dependency on the ephemeris, calculation crate or tarot and cannot
read files, fetch, store records or return prose. The astrology WASM adapter hosts
both calculation and interpretation. The existing separate tarot WASM stays separate.

`NatalInput` contains ten bodies, longitudes/speeds, sampled possible signs, supported
houses/ASC/aspects, certainty/polar capability and the configured orbs. It contains no
birth date, coordinates, zone, name or notes. The adapter validates saved calculation
facts before their use; the pure interpreter independently validates its projection.
Worker requests are local messages, never remote interpretation requests.

## Versions and immutable packs

Tuple: schema 1; calculation 0.1.0; interpretation natal.1; semantics
natal-semantics.1; rules natal-rules.1; English prose natal.en.1. Atlas versions are
separate from interpretation because changing city search must not change a saved
chart. Every changed sentence, meaning or editorial rule requires a new corresponding
version. Locale packs share reference IDs; only English is supplied in this release.

Rust-generated schema/TypeScript types define `InterpretationPlan`, not tarot
`ReadingPlan`. The plan carries placements, full supported aspects, core IDs, ranked
relationship IDs, evidence-backed theme items, life topics and distributions. Each
item has a content reference, rule ID, priority and exact bodies/sign/house/aspect/orb
support. TypeScript resolves references and formats numbers; it does not rank,
select or independently infer interpretations.

The Worker validates and retains symbolic packs once per supported tuple. Prose is
loaded separately by the page. Failed loading is retryable against the same chart.
Bounded collections and strict field validation reject unsupported packs instead of
substituting another version. Stale completions cannot replace a newer chart.

## Capability matrix

| Fact policy | Sign text | ASC/houses | Major aspects | Distributions |
| --- | --- | --- | --- | --- |
| Exact, latitude below 66° | Calculated sign | Available | Calculated | Exact placement counts |
| Exact, absolute latitude at least 66° | Calculated sign | Omitted | Calculated | Exact placement counts |
| Approximate/unknown | Conditional sampled alternatives | Omitted | Omitted | Separately labeled sampled counts |

A single observed sign in an interval is still a sample, not a certified invariant.
Ambiguous bodies do not enter fixed element/modality counts. Midpoint longitudes
remain labeled representative. Existing 15-minute sampling and UTC-as-UT1 limitations
are preserved. No extension to interval houses/aspects or polar angles is implied.
Display degrees must never round 29°59′ into 0° of the same sign.

## City input and privacy

Static country shards from a pinned GeoNames snapshot provide explicit coordinates,
IANA IDs and aliases. The atlas covers all 244 countries/territories in the pinned cities15000 snapshot,
34,159 cities, with country-specific lazy loading. It does not cover every settlement. City coordinates are
representative points. We do not infer zones from longitude, nearest cities or the
device; boundary/renamed/missing places have manual correction. Current geographic
assignments and pre-1970 civil-time limits are disclosed. Rust's embedded IANA data
resolves the birth date's historical offset and prompts for an actual gap/fold only.

Records stay in the root Zustand provider until explicit local save. No question or
birth record enters a URL, log, telemetry or remote request. Entry is disabled during
initial hydration so the browser cannot submit an unhandled native form.

## Presentation and storage

One crystal world anchor survives entry, overview, body and relationship focus.
Camera position/target change continuously in the same scene; art is not swapped for
a separate screen. Marker displacement only affects display and retains a line to
true longitude. HTML and Canvas share body/pair/clear intents and one selection state.
Per-frame coordinates stay scene-local. Frames use the usable viewport excluding
panels. Reduced motion snaps to the same final framing; abandonment disposes local
resources and rejects stale readiness events.

The HTML report is independently readable and linked to the same focus. It includes
core map, supported themes, principal relationships, life topics, all supported
placements, calculation tables, glossary and uncertainty. The crystal is a symbolic
longitude map, never a physical solar-system model. Editorial priority is not a
personality/quality score.

The new explicit save envelope retains the original chart/input, versions and atlas
selection provenance. Legacy `astrology-chart.v1` facts remain available; new
interpretation requires an explicit action. Unsupported interpretation versions offer
labeled regeneration of interpretation, not silent recalculation. Unsupported facts
require explicit recalculation. Original storage is untouched until Save; Delete
removes documented current and legacy keys.

## Research and alternatives

Cafe Astrology's [report structure](https://cafeastrology.com/articles/how-to-read-natal-chart-report.html),
[entry](https://astro.cafeastrology.com/natal.php), [placement index](https://cafeastrology.com/natalastrology.html)
and [FAQ](https://cafeastrology.com/freereportsfaq.html) informed scope and navigation,
not wording. Its Placidus output is not a numerical reference for our Whole Sign chart.
All new prose is authored locally. Automated coverage is not human editorial approval.

A remote geocoder/LLM would add private-data exposure, cost and nondeterminism. A TS
interpretation engine would duplicate Rust authority. Downloading all worldwide cities initially would cost unnecessary bytes.
A generated country catalog and versioned, lazily selected shards keep initial
loading bounded while supporting international city search.

## Implementation references

- [Content provenance and editorial ranking](../../content/astrology/natal/README.md)
- [Atlas licensing, transforms and coverage](../../content/astrology/atlas/README.md)
- [Scene, camera and cancellation contract](../contracts/natal-scene.md)
- [Representative prose review](../validation/natal/editorial-review.md)

Persistence uses `pxoracle.natal-report.v1` with envelope schema 1, original input/chart,
InterpretationPlan, the six-version tuple, atlas/manual PlaceProvenance and explicit
savedAt timestamp. Supported plans are compared with deterministic regeneration before
display (object key order does not matter). Failure retains the expected saved plan
through retries and route abandonment. A separately labeled regeneration action clears
that expectation; it never overwrites storage automatically. Legacy chart/input keys
remain readable and are included in explicit deletion.
