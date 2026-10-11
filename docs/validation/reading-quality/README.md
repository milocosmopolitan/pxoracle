# Tarot editorial quality, release 2

This is the archived editorial candidate evidence (`reading.en.2`). The same reviewed strings are now integrated as `reading.en.1.1`; see [current-app integration and verification](integration-1.1.md). Historical hashes and results below retain their original versions.

This change improves production sources, not exported CSV text. Work started at `92d7861` on the isolated `feat/tarot-editorial-quality` worktree; the user's original checkout and local changes were preserved. No runtime LLM, remote interpretation service, new draw ritual, scene change or private input was added.

## Baseline and scope

Input: the 12 `*-review.csv` files in `~/pxoracle-exports/reading-export-1b53168`, exported from `1b53168fb3ed7fd1dbf73cd7d29b37b0f89eb3a3`. Each contains the same 2,696 canonical cases, totaling 32,352 rows. The original packs' SHA-256 values match the current starting source. Re-rendering all supplied cases through the unchanged native Rust interpreter and production `composeReading` reproduced every input CSV byte-for-byte.

The bounded audit found that actions and questions were identical across all three intents for every case. Across topics, removing four introductory scope phrases made all 2,696 actions/questions identical. These are diagnostics explaining the dispatch defect, not quality scores or population estimates.

Four topic review passes examined the same 28 anchors across all three intents: 336 complete readings. Three agents worked concurrently; the work reviewer subsequently performed the growth pass. A fresh independent validator read those 336 compositions and another 132 advice rows to cover all 21 primary relation families. It also independently compared all 32,352 rows for preserved identity/core content. Most initial anchors have The Fool first; this is not an exhaustive editorial review of every position permutation.

## Production changes

- 252 original action/question pairs are authored by rule, topic and intent. Rust validates/selects the nested maps; TypeScript does not duplicate those rules.
- All nine position roles now use orientation-specific card fields. Hermit reversed no longer describes isolation in its core and dependence on agreement in its role paragraph.
- Care/boundaries advice can request support or reduce scope. It no longer automatically asks an exhausted person to offer more support.
- Overall text names cards; relation phrases name their actual participants. Ordered complements no longer imply the earlier resource has already been secured.
- Fallback keeps the third card's exact action/question, supplies context and explicitly describes an absent shared card theme. It does not judge the user's real relationship.
- Old packs remain immutable. New filenames/versions are `reading.2`, `semantics.2`, `rules.2`, `reading.en.2`; existing saves preserve cards and require explicit reinterpretation and Save.

Of 26 topic findings, 21 are implemented or preserved controls. Five remain partially addressed, grouped around richer role/theme contribution and topic-specific synthesis. The independent validator identified two additional candidate regressions, an assumed interpersonal response in an inward fallback and duplicate third-position framing. Both were corrected and checked against final CSVs.

## Before and after

Read [six complete matched examples](examples.md), with full raw rows in [examples.json](examples.json). Case `4351`, work/action, originally asked the user to offer more support despite reversed Strength and Death. It now says:

> Clarify the scope of one support commitment so it fits available capacity; request help or propose a smaller contribution where needed.

Case `4935`, growth/action, keeps Hermit reversed's authored difficulty, “isolation being defended as independence,” instead of replacing it with dependence on agreement. Case `0` in creativity now distinguishes examining the current draft, comparing two directions and testing an alternate version.

Final matched outputs preserve cards, orientations, context, role IDs, lenses, relation IDs/evidence, fallback decisions and all core card paragraphs across all 32,352 rows. Revised advice is no longer identical across the three intents or four topics in this set. That lexical result does not establish good interpretation by itself.

Machine-readable evidence:

- [delta.json](delta.json): input/output hashes, old/new versions, aligned coverage and changed sections.
- [topic-findings.json](topic-findings.json): original findings, source references, proposed changes and integration dispositions.
- [independent-validation.json](independent-validation.json): fresh raw-output review, corrected regressions, coverage and limitations.
- [sizes.json](sizes.json): measured raw/gzip pack and tarot WASM sizes.
- [checks.json](checks.json): exact commands, outcomes and final browser/export counts.
- [review-coverage.json](review-coverage.json): full relation scan, rule reachability and card/orientation/position coverage.

Full review CSVs, baseline/final audits, checkpoints and logs remain outside git in `~/pxoracle-exports/editorial-20261011`. A fresh relation scan covered all 3,651,648 draws, found all 21 rules both reachable and primary, and selected the same 2,696 review cases with all 468 card/orientation/position combinations. The resulting 32,352 texts match the independently reviewed rerender. No 43-million-row full text export was regenerated. The canonical validation sample covers cases `0..1000`, 12,000 rows, and must not be described as exhaustive output validation.

## Reproduction

Use Node 22.16.0, Rust 1.90.0 and Emscripten 4.0.10. The first local WASM attempt accidentally used an installed Emscripten 6.0.12 and failed linking; the corrected 4.0.10 build passed. The first Node suite overlapped the static build and found a missing export file; the suite passed after the build completed. Neither failed attempt is counted as a successful gate.

```sh
python3 scripts/build-reading-content.py --check
cargo test --locked
npm run wasm
bash scripts/generate-schemas.sh
npm run typecheck
npm run build
npm test
npm run build-storybook
python3 -m unittest discover -s .agents/skills/improve-tarot-readings/scripts -p 'test_*.py'
npm run reading-export -- sample --out /new/output/sample --start 0 --end 1000 --jobs 2
npm run reading-export -- validate --out /new/output/sample
npm run reading-export -- review --out /new/output/review --reviewer-copies --jobs 2
PXORACLE_TEST_PORT=4188 npx playwright test tests/browser/reading.spec.ts --project chrome --project mobile-chromium-emulation
npx playwright test tests/storybook/reading.spec.ts --config playwright.storybook.config.ts
```

To reproduce an identical original case set instead of selecting a new one, pass the original `review-cases.json` array to `renderCases` in `scripts/reading-export/review.mjs`, with `loadPacks()`, `deckSize: 78`, and a fresh output directory, then `writeReview`. That path runs the compiled native batch interpreter and `rowFromPlan`, which calls production `composeReading`. Compare by case/context/cards/orientations, recording both version tuples rather than treating the releases as identical.

## Remaining limits

Synthesis still uses 21 shared theme sentences. Named participants and their adjacent position paragraphs improve traceability, but the relation sentence itself does not explain each card's role/theme contribution. Secondary relation headings/body can repeat card names. Fallback remains a contextualized single-card suggestion rather than bespoke three-card synthesis, intentionally preserving weak-link honesty.

English only. No physical mobile-device qualification is claimed; browser mobile tests use Chromium emulation. Topic-agent and independent-agent editorial review are not human content approval: `humanEditorialApproval` remains `false`. This source change is not merged or deployed by this task.
