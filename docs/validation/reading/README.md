# Free reading qualification

Baseline: main `415f491` (PR #27 merged), 2026-10-11. No camera, rig, card Mesh, shader or art changes are part of this epic.

## Implemented scope

Four topics × three intents, frozen at shuffle; optional unanalysed memory-only note; 156 orientation meanings; 21 deterministic relationship rules; complete overall flow, evidence, one small action, one question and indexed card details. The pure Rust crate chooses references. The browser resolves external English prose. Saved v2 envelopes pin context and versions without changing the old draw schema/positions. Legacy and unavailable versions require explicit user action. One-card reflection stays separate.

## Evidence

- `cargo test --locked`: 16 tests passed, including five interpretation tests. The interpretation matrix alone evaluates 5,616 combinations of card/orientation/position/topic/intent, each twice for determinism.
- `npm run wasm`: Emscripten 4.0.10 build passed; separate tarot and astrology artifacts retained.
- `npm run typecheck`, `npm run build`, `npm run build-storybook`: passed. Static output includes `/`, `/tarot/`, `/astrology/`.
- `npm test`: 44 tests passed. Native/WASM equality covers 18 frozen representative plans plus all 156 meanings. Coverage checks all 1,218 prose references, four topics, nine roles, unique orientation actions/questions, unknown fields, invalid cards/positions/versions, cached Worker initialization, retry, persistence and existing scene/draw behavior.
- `node scripts/check-boundaries.mjs`: passed. Schemas/types regenerated from Rust DTOs.
- `node scripts/verify-reading-browser.mjs`: actual headless Chromium 141.0.7390.37, desktop 1355×900 and mobile emulation 390×844. See [machine report](browser.json). Real draw → selection → reveal → reading → save → reload/restore; failing rule download → same-card retry; failed saved-draw engine initialization → same-session restore retry; explicit legacy perspective; unavailable-version regeneration without automatic overwrite; deletion; keyboard detail selection; note/request privacy; route abandonment; independent one-card loading. No page errors.
- `node scripts/verify-reading-stories.mjs`: twelve actual Storybook states, including the 12-perspective selector, all reversed, repetition, complement, weak fallback, error/retry, legacy, mobile, keyboard, unsupported-version confirmation and the existing mocked tarot scene without WASM. See [report](storybook.json).

Screenshots: [desktop scene](desktop-scene.png), [desktop reading](desktop-reading.png), [mobile reading](mobile-reading.png), [Storybook](storybook.png). The fixtures are explicitly synthetic and produced by the native interpreter; no user records are used.

## Editorial review

[Complete rendered examples](examples.md) contain all 12 contexts plus all-reversed, repetition, ordered complement, weak fallback, court/minor and mixed-orientation examples. The agent reviewed the resulting paragraphs, actions and questions together:

- Fool / Emperor / Temperance: exploration and boundaries resolve into a bounded experiment. Across the 12 contexts the topic framing and position roles change; the action remains consistent with the same leading tension.
- Reversed Hermit / Nine of Swords / Five of Pentacles: support and recovery, not three negative predictions. The action asks for a practical resource; the question asks what needs support.
- Fool / Magician / Chariot: clarity precedes effort; a small observable step follows that relationship. Reordering is separately tested because this rule is directional.
- Fool / Magician / Ace of Cups: no supported relation is declared. Position flow and the third card's feeling-naming action remain explicit; no hidden story is invented.
- Court/minor and mixed-orientation examples exercise practical skill, limits and revision without equating court ranks with demographics or guaranteeing outcomes.

Core meanings are the existing `en.v1` prose; new orientation-specific resources/difficulties/actions/questions are independently authored. Theme/role clauses are intentionally reusable. Relationship text is not repeated verbatim in the whole-reading and relationship sections. This is an agent editorial pass, **not human content approval**.

## Size and loading

See [exact byte/gzip measurements](sizes.json). Tarot WASM is 499,810 bytes (142,465 gzip). Semantics: 203,165 (10,990 gzip); rules: 15,958 (1,320 gzip); prose: 122,043 (27,753 gzip). Content totals 341,166 bytes, 40,063 gzip. The prior tarot WASM was 254,233 bytes (88,055 gzip); interpretation adds 54,410 compressed bytes to the existing first-shuffle engine download. These are encoded artifact sizes, not a promised network latency.

No WASM or new packs load merely by opening the tarot form. Shuffle loads only the tarot engine. Three revealed cards trigger interpretation packs; one-card reflection does not request them. Semantics/rules install once per worker; duplicate requests reuse that validated interpreter. Prose remains outside WASM. Browsers never request an interpretation service or send notes in wire payloads.

## Reproduction

Run the six AGENTS gates, then serve `apps/web/out` on 4180 and `apps/web/storybook-static` on 6180. Run the two `verify-reading-*.mjs` scripts. `playwright.reading.config.ts` also provides the focused production reading + existing tarot regression suite, and the new tests are included in the existing CI browser matrix. `node --import tsx scripts/render-reading-review.mjs` regenerates readable examples and artifact sizes from frozen plans/built artifacts.

## Limits

English only; 12 symbolic themes and 21 relationships, not every interpretive tradition. Human editorial sign-off is pending. This epic's local browser qualification is Chromium desktop and emulated mobile, not a physical phone or fresh Safari/Firefox qualification. No new frame-rate, cloth-performance or artwork-quality claim is made. Existing Storybook large-chunk/use-client warnings and upstream C/example-name warnings remain visible; they do not fail the required builds.

## CI execution boundary

PR #27 run `38120393533` exceeded the existing 25-minute job limit during its serial browser matrix (GitHub check annotation confirmed the timeout). The workflow now builds/tests once, uploads the same static app and Storybook, and runs Chrome, Firefox, WebKit and mobile Chromium in separate jobs with `fail-fast: false`. Storybook and actual Safari retain separate jobs. No browser or assertion is removed. This avoids letting one slow browser consume the whole qualification budget.

The focused local production suite covered 12 desktop/mobile scenarios: eight existing tarot/fallback scenarios passed, and all four structured-reading/legacy scenarios passed on the final rerun. The earlier restore comparison was corrected to compare visible text consistently, instead of comparing `innerText` with hidden `textContent`.
