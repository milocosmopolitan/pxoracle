# Source map

Verify paths and current versions before editing.

| Boundary | Current source | Responsibility |
| --- | --- | --- |
| Card/orientation meanings | content/tarot/reading/cards.tsv; content/tarot/en.v1.json | Resources, difficulties, actions, questions, core meanings |
| Topic context | content/tarot/reading/themes.tsv | Four topic perspectives and reusable advice |
| Position context | content/tarot/reading/roles.tsv | Nine intent-specific role clauses |
| Relationships | content/tarot/reading/relations.tsv | Tensions, ordered complements and advice |
| Compilation | scripts/build-reading-content.py | Repetition/flow prose, reference IDs and generated packs |
| Interpretation | crates/pxoracle-tarot-reading/src/lib.rs | Roles, evidence, priorities, deterministic Phrase selection |
| DTO ownership | crates/pxoracle-tarot-reading; packages/contracts | Rust schemas and generated TS contracts |
| Localization/rendering | apps/web/src/features/tarot/reading.ts | renderPhrase, composeReading, version checks |
| Export | scripts/reading-export/ | Actual production text, review selection and parity validation |
| Evidence | tests/fixtures/readings.json; docs/validation/reading/ | Golden plans and rendered examples |

At the initial skill revision, relation action/question references are keyed by topic in Rust, not intent. The builder creates different topic references by adding a topic prefix to common advice. Investigate this in the current source before proposing a fix; a text-only patch cannot introduce a missing intent selector. A relation may appropriately remain context-independent even when its advice must differ.

Generated packs exist both in content/tarot/reading and apps/web/public/content/reading. Never hand-edit one copy. Version consumers include Rust Versions defaults, generator versions, frontend READING_VERSIONS and loadProse URL, schemas/contracts, fixtures and export identities. Regenerate affected schemas with scripts/generate-schemas.sh when DTOs change.

The TSV files currently use a literal | delimiter; follow their actual column layout and avoid embedding that delimiter in prose. Keep localized sentences outside WASM.

## External reference

Design inspiration: https://github.com/tarotap/skills/tree/main/ai-tarot-reading (inspected 2026-10-11). Apply the general principles of position-sensitive meaning, synthesis and user agency. This skill is independently authored for PXOracle; it does not copy Tarotap's reading format, draw script, card meanings or imagery. The referenced interactive Markdown-reading workflow is not our product architecture.
