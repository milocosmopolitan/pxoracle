# ADR 004: Deterministic three-card reflection

Status: implemented for epic #28. Human editorial approval remains separate from automated qualification.

## Context and integration

Work began from PR #27 (`dcc3d77`) because the original main lacked its interaction flow. During implementation #27 merged as `415f491`; the branch fast-forwarded to that main commit (identical source tree). The final PR targets main. Camera, hand rig, meshes, materials and original user working-tree edits are outside this epic.

## Ownership

The existing `pxoracle-tarot` crate still owns the complete deck, randomization, selection, orientation, reveal and strict session validation. Its `en.v1` content contract and fixed `situation`, `examination`, `next_action` IDs are unchanged.

`pxoracle-tarot-reading` is a separate pure Rust crate with no draw-core dependency. It accepts exactly three ordered public card IDs/orientations/position IDs, a topic/intent, and pinned versions. It receives neither a deck nor a note. It validates external symbolic semantics/rules once, then produces a `ReadingPlan` of references and evidence. It does not embed prose, read files, fetch, render, or mutate a draw.

The existing tarot WASM adapter contains both crates. A second WASM worker/artifact would duplicate initialization and transport without providing a separate page boundary. The tarot Worker lazily fetches only semantics/rules, shares concurrent initialization, and caches the validated interpreter for its lifetime. Subsequent requests contain the small public input. Failed installation clears the cache for retry. Worker eviction creates a fresh cache. Astrology remains independently loaded.

TypeScript loads the English prose pack and substitutes only the references and arguments selected by Rust. It does not evaluate theme or relationship rules. Missing references fail visibly. The root Zustand store owns the fixed context, versions, plan and loading/error state. Hook cleanup aborts prose fetches and prevents late results from changing an abandoned reading. Existing controller/Scene responsibilities and card indices remain intact.

## Version and contract policy

Current tuple: schema `1`, engine `reading.1`, semantics `semantics.1`, rules `rules.1`, content `reading.en.1`. These are independent of the draw session's engine and `en.v1` versions. Generated JSON Schema and TypeScript declarations come from Rust DTOs. JSON Schema checks structural bounds, known enums, version constants and card ID syntax; Rust additionally checks uniqueness, complete packs and exact position order.

Intent roles map onto the three old position IDs in order:

- Present: visible situation, examination, helpful direction.
- Crossroads: values, overlooked conditions, checks before deciding.
- Action: foundation, difficulty, small action.

Changing intent never changes a persisted draw's position IDs. New draws fix context at shuffle. Legacy draws request an explicit perspective. One-card draws retain the separate simple reflection and do not load interpretation packs.

A content release is immutable under its version. Any changed sentence requires a new content version; changed meanings or priorities require their respective versions, updated compatible tuples and fixtures. A future locale supplies the same reference contract with its own localized content version and locale. This release serves English only; it never silently substitutes a different locale/version.

## Evaluation and assembly

The external pack has 156 orientation-specific meanings, each with 1–3 themes, a reversal lens, card-specific core/resource/difficulty/action/question references, four topic references and nine role references. Reversal lenses are inward, blockage, excess, review or restoration; upright meanings use direct. Reversal is not a negative multiplier.

21 explicit rules cover 12 repetitions, six tensions and three ordered complements. A rule needs support from at least two distinct positions. Repetition and tension are symmetric; complement requires its left theme earlier than its right theme. The evidence is the sorted union of positions supporting matched pairs.

Order candidates by descending priority, then ascending rule ID, then ascending evidence indices. Keep at most two. Priorities: tensions 80–90, complements 65, repetitions 40. The first rule supplies both the final relationship paragraph and the single action/question, with identical evidence indices. The second rule is explanatory only. With no supported rule, use an explicit weak-link paragraph and the third card's authored action/question.

The overall sequence uses intent-specific framing, the first card's topic/resource, the second card's difficulty, the third card's role and the primary relationship or fallback. Card details preserve selection order and expose core, role and topic. This is finite editorial composition, not question analysis or a prediction. Theme clauses are intentionally reusable; card-specific resources/difficulties and all 156 action/question pairs are distinct. We do not enumerate every three-card combination.

Limits: 156 exact meanings, at most 6,000 unique reference IDs, 64 rules, priorities 0–100, IDs 1–96 ASCII characters. The wire is capped at 1,000,000 characters; each downloaded pack at 750,000; localized strings at 1,500. Invalid or incompatible input returns a stable error rather than a guessed reading.

## Persistence and privacy

`pxoracle.tarot.v2` stores `{schemaVersion:2, draw, perspective, readingVersions}` only on Save. The note is always memory-only, with that policy stated before input. It never enters WASM, URLs, telemetry, content fetches or saved envelopes.

The old `pxoracle.tarot.v1` wrapper is read only if v2 is absent. Its draw is validated by the unchanged Rust engine; missing perspective requires explicit selection. A corrupt v2 never falls back silently to v1. Both envelopes are deleted together. Completing a draw does not change its interpretation input.

Supported pinned versions reproduce the same plan. Unavailable versions preserve the cards and require an explicit “Reinterpret these cards with current content” action, with a warning that interpretation/wording may change. This does not overwrite storage until Save. A temporary content failure offers same-version retry without reshuffle. No migration relabels or replaces selected cards.

## Alternatives and consequences

A TS rules engine would duplicate Rust authority and weaken native/WASM parity. Embedding prose in WASM would couple localization to compiled code and violate the architecture. An online generator would add cost, privacy exposure and non-determinism. A fixed paragraph for every combination would be unreviewable. External authored data plus a small pure evaluator gives bounded, inspectable behavior at the cost of a deliberately limited semantic vocabulary.

See [validation](../validation/reading/README.md), [authored examples](../validation/reading/examples.md), and [content provenance](../../content/tarot/reading/README.md). Tests establish consistency and coverage, not human approval or objective divinatory validity.
