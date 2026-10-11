# Source map

Verify paths and current versions before editing.

| Boundary | Current source | Responsibility |
| --- | --- | --- |
| Card/orientation meanings | content/tarot/reading/cards.tsv; content/tarot/en.v1.json | Resources, difficulties, actions, questions, core meanings |
| Topic context | content/tarot/reading/themes.tsv | Four topic perspectives |
| Position context | content/tarot/reading/positions.tsv | Nine frames applied to orientation-specific card fields |
| Context-sensitive advice | content/tarot/reading/advice-<topic>.tsv; fallback.tsv | Rule/topic/intent action-question pairs and weak-link context |
| Relationships | content/tarot/reading/relations.tsv | Tensions, ordered complements and advice |
| Compilation | scripts/build-reading-content.py | Repetition/flow prose, reference IDs and generated packs |
| Interpretation | crates/pxoracle-tarot-reading/src/lib.rs | Roles, evidence, priorities, deterministic Phrase selection |
| DTO ownership | crates/pxoracle-tarot-reading; packages/contracts | Rust schemas and generated TS contracts |
| Localization/rendering | apps/web/src/features/tarot/reading.ts | renderPhrase, composeReading, version checks |
| Export | scripts/reading-export/ | Actual production text, review selection and parity validation |
| Evidence | tests/fixtures/readings.json; docs/validation/reading/ | Golden plans and rendered examples |

Release 2 uses `advice-<topic>.tsv`: one authored action/question pair per rule and intent. Rust validates and selects the nested topic/intent maps. `fallback.tsv` frames the third card's unchanged advice, and `positions.tsv` grounds each position in that orientation's own resource/difficulty/action/question. `roles.tsv` and the advice columns of themes/relations are release-1 history, not active dispatch.


Generated packs exist both in content/tarot/reading and apps/web/public/content/reading. Never hand-edit one copy. Active filenames are `semantics.2.json`, `rules.2.json`, and `reading.en.1.1.json`; release-1 files remain immutable. Version consumers include Rust Versions defaults, generator versions, frontend READING_VERSIONS and loadProse URL, schemas/contracts, fixtures and export identities. Regenerate affected schemas with scripts/generate-schemas.sh when DTOs change.

The TSV files currently use a literal | delimiter; follow their actual column layout and avoid embedding that delimiter in prose. Keep localized sentences outside WASM.

## External reference

Design inspiration: https://github.com/tarotap/skills/tree/main/ai-tarot-reading (inspected 2026-10-11). Apply the general principles of position-sensitive meaning, synthesis and user agency. This skill is independently authored for PXOracle; it does not copy Tarotap's reading format, draw script, card meanings or imagery. The referenced interactive Markdown-reading workflow is not our product architecture.
