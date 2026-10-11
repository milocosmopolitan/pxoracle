# English reflection content, release 2

These files are reviewed as source content, not embedded in a Rust binary.

- `cards.tsv`: 78 rows with two distinct orientation-specific theme sets, reversal lens, resource, difficulty, action and question. Columns are documented in `scripts/build-reading-content.py`; delimiter is `|`.
- `themes.tsv`: 12 symbolic themes with four topic perspectives. Its final two legacy advice columns are retained as release-1 authoring history and are not used by release 2.
- `positions.tsv`: nine position frames grounded in each card's own orientation-specific resource, difficulty, action or question. `roles.tsv` remains release-1 history; its theme-only clauses are no longer compiled.
- `relations.tsv`: six tensions and three ordered complements. Its legacy advice columns are superseded by the four `advice-<topic>.tsv` files.
- `advice-<topic>.tsv`: 21 rules × three intents per topic, 252 independently authored action/question pairs. Rust selects topic and intent; TypeScript only resolves the resulting references.
- `fallback.tsv`: 12 context frames around the third card's unchanged action/question. These contextualize a weak-link reflection without inventing a relationship.
- Active generated packs: `semantics.2.json`, `rules.2.json`, `reading.en.1.1.json`, with 156 meanings, 21 rules and 2,876 English references.
- Release-1 JSON files remain byte-for-byte immutable. New saved readings pin the release-2 tuple; restoring release 1 preserves cards and asks before reinterpretation.

Run `python3 scripts/build-reading-content.py`, then `node scripts/build-reading-fixtures.mjs` after an intentional semantic change. `--check` detects stale generated source/public copies. Review the diffs and version changes; do not regenerate golden plans simply to hide a test failure. `scripts/generate-schemas.sh` regenerates Rust-owned schemas/types separately.

## Sources and authorship

Historical symbolic references researched on 2026-10-11:

- A. E. Waite, *The Pictorial Key to the Tarot* (1910), [Part II, major-arcana symbolism](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_2).
- Same work, [Part III, 78-card and reversed meanings](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3).

This historical public-domain work is background research, not a source of copied modern prose. The new sentences were authored for PXOracle. We deliberately do not reproduce historical fortune-telling guarantees, diagnoses, gender/appearance stereotypes or claims that cards identify another person's intentions. Court cards describe ways of acting, not demographics. Reversals are editorially interpreted through inward attention, blockage, excess, review or restoration rather than mechanical negation.

Card names and core orientation paragraphs are reused unchanged from the repository's `content/tarot/en.v1.json` at PR #27 baseline `dcc3d77`; this release adds card-specific resources/difficulties/actions/questions and structured context around that existing content. Existing artwork provenance and rights are unchanged. No third-party commercial meanings database or image license is imported. These original text additions follow the repository's existing licensing policy; this document does not assign a new license to user-supplied art.

## Editorial method and limits

Each orientation has an independently authored action and question, not a card-name substitution. Topic clauses remain theme-based building blocks shared by related cards; role frames now use each orientation's own authored fields. Relationship rules need evidence from at least two cards. Weak links use a disclosed position-flow fallback rather than invented associations. A reversal can describe recovery or regained access to a resource.

Historical release-1 examples for the 12-topic/intent matrix, reversed spread, repetition, complement and weak relationship are retained in [examples](../../../docs/validation/reading/examples.md). The implementation review checks that the main relationship and action point in the same direction and that prompts remain small, non-predictive and safe to decline. Automated tests check completeness/determinism/reference integrity. Neither those tests nor an agent's editorial pass constitutes a human content sign-off.

The vocabulary is deliberately limited to 12 themes and 21 relationships. It does not model every traditional school or every subtle combination. English is the only implemented locale. Additional locales must preserve reference IDs/arguments and receive a distinct content version; they may need different sentence framing, not word-by-word concatenation. No user note is interpreted.

## Release-2 editorial evidence

[Quality review](../../../docs/validation/reading-quality/README.md) records the 12 supplied CSVs, hashes, source revision, 32,352 matched production outputs, four topic review passes and a fresh independent validator. Original core card paragraphs, draw IDs/orientations, roles, themes, priorities and relation evidence stay unchanged. Named evidence and orientation-specific position text improve traceability, while synthesis still uses a limited vocabulary of shared relation sentences. Agent review is not human editorial approval.
