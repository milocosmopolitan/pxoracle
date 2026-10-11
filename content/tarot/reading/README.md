# English reflection content, release 1

These files are reviewed as source content, not embedded in a Rust binary.

- `cards.tsv`: 78 rows with two distinct orientation-specific theme sets, reversal lens, resource, difficulty, action and question. Columns are documented in `scripts/build-reading-content.py`; delimiter is `|`.
- `themes.tsv`: 12 symbolic themes, each with four authored topic perspectives and a reusable action/question.
- `roles.tsv`: 12 themes × nine intent-specific position clauses.
- `relations.tsv`: six tensions and three ordered complements. Twelve repetition clauses and intent framing live in the content builder.
- Generated `semantics.1.json` / `rules.1.json`: symbolic data and references only.
- Generated `reading.en.1.json`: 1,218 English strings including names, 156 core meanings, distinct orientation-specific resources/difficulties/actions/questions, topic/role clauses and relationship/flow templates.

Run `python3 scripts/build-reading-content.py`, then `node scripts/build-reading-fixtures.mjs` after an intentional semantic change. `--check` detects stale generated source/public copies. Review the diffs and version changes; do not regenerate golden plans simply to hide a test failure. `scripts/generate-schemas.sh` regenerates Rust-owned schemas/types separately.

## Sources and authorship

Historical symbolic references researched on 2026-10-11:

- A. E. Waite, *The Pictorial Key to the Tarot* (1910), [Part II, major-arcana symbolism](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_2).
- Same work, [Part III, 78-card and reversed meanings](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3).

This historical public-domain work is background research, not a source of copied modern prose. The new sentences were authored for PXOracle. We deliberately do not reproduce historical fortune-telling guarantees, diagnoses, gender/appearance stereotypes or claims that cards identify another person's intentions. Court cards describe ways of acting, not demographics. Reversals are editorially interpreted through inward attention, blockage, excess, review or restoration rather than mechanical negation.

Card names and core orientation paragraphs are reused unchanged from the repository's `content/tarot/en.v1.json` at PR #27 baseline `dcc3d77`; this release adds card-specific resources/difficulties/actions/questions and structured context around that existing content. Existing artwork provenance and rights are unchanged. No third-party commercial meanings database or image license is imported. These original text additions follow the repository's existing licensing policy; this document does not assign a new license to user-supplied art.

## Editorial method and limits

Each orientation has an independently authored action and question, not a card-name substitution. Topic and role paragraphs are intentionally theme-based building blocks shared by related cards. Relationship rules need evidence from at least two cards. Weak links use a disclosed position-flow fallback rather than invented associations. A reversal can describe recovery or regained access to a resource.

The 12-topic/intent matrix, reversed spread, repetition, complement and weak relationship examples are rendered in [examples](../../../docs/validation/reading/examples.md). The implementation review checks that the main relationship and action point in the same direction and that prompts remain small, non-predictive and safe to decline. Automated tests check completeness/determinism/reference integrity. Neither those tests nor an agent's editorial pass constitutes a human content sign-off.

The vocabulary is deliberately limited to 12 themes and 21 relationships. It does not model every traditional school or every subtle combination. English is the only implemented locale. Additional locales must preserve reference IDs/arguments and receive a distinct content version; they may need different sentence framing, not word-by-word concatenation. No user note is interpreted.
