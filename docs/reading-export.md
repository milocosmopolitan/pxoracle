# Exhaustive reading export (offline)

Exports the real deterministic three-card reading text for every ordered draw and orientation, in each of the 12 topic/intent contexts. It is an offline/release task. It is not run in CI, is not served by the web app, and its large outputs are never committed.

## Scope

78 × 77 × 76 ordered distinct cards × 8 orientation masks = **3,651,648 cases per context**; 4 topics × 3 intents = 12 contexts → **43,819,776 rows**. "Reversals disabled" is the all-upright subset (mask 0). Shuffle seeds/slots, animation, private notes and one-card readings are not dimensions.

## Case IDs

`case_id = rank × 8 + mask`, 0-based and independent of context, text, chunking or scheduling.

* Deck order is the canonical `card_ids()` order: `major.00`…`major.21`, then `wands`, `cups`, `swords`, `pentacles` `.01`…`.14` (`deckSha256` in the manifest).
* `rank` is the lexicographic rank of the ordered triple `(a, b', c')` where `a` is the position-1 deck index, `b'` the 0-based index of position 2 among the cards not yet used (77 remaining), and `c'` that of position 3 among 76. `rank = (a·77 + b')·76 + c'`.
* `mask` bit `i` (value `1<<i`) is set when position `i+1` (0: situation, 1: examination, 2: next action) is **reversed**. Mask 0 is all upright, 7 all reversed.
* Reference vectors: `0` = major.00 / major.01 / major.02 upright; `1` = same cards with position 1 reversed; `4` = position 3 reversed; `8` = major.00, major.01, major.03; `3651647` = pentacles.14, .13, .12 all reversed.

Row order in all 12 files is ascending `case_id`. Rust (`src/export.rs`) and the Node validator (`common.mjs`) implement the enumeration independently.

## Files

Written to `--out DIR` (choose a durable user-controlled location outside the repository, e.g. `~/pxoracle-exports/reading-export-<commit>`):

| File | Content |
| --- | --- |
| `<topic>-<intent>.csv.gz` ×12 | Full rows (UTF-8 CSV, multi-member gzip). Topics `relationships work creativity growth`, intents `present crossroads action`. |
| `<topic>-<intent>-review.csv` ×12 | Representative cases, same columns, same case set in all 12 files. |
| `reading-content.csv` | Every authored string with usage category/columns/reference counts. |
| `review-cases.json` | Selected case IDs and why each was chosen. |
| `manifest.json` | Written last. Versions, source commit/dirty digest, input hashes, counts, case range, per-file SHA-256, completion state. |
| `reports/validation-report.{md,json}` | Gates, parity, rule/fallback frequencies, cross-context differences. |
| `reviewer/*.reviewer.csv` | Optional (`--reviewer-copies`): `review_reasons`, `reviewer_status`, `reviewer_comment`, formula-neutralised cells. |
| `.export-work/` | Checkpoints; removable with `--cleanup` after verified completion. |

Columns: `case_id, topic, intent`, then for each of 3 positions `card_N_id, card_N_name, card_N_orientation`, then `position_N_role, position_N_role_label, position_N_lens`, then `overall_text, relation_rule_ids, relation_evidence, relation_text, fallback, action_text, question_text, position_1_text … position_3_text, engine_version, semantics_version, rules_version, content_version, export_schema_version`.

Text columns are exactly what the reading screen shows (`composeReading`): `overall_text` joins the overall phrases with a space; paragraph sections (`relation_text`, `position_N_text`) join paragraphs with `\n`; `relation_evidence` is `kind:positions` joined by `|` (e.g. `tension:1+3`); a fallback row shows the fixed fallback sentence. The primary relation's sentence appears inside `overall_text`, so `relation_text` shows the screen's "main connection described above" pointer for it, as the UI does.

CSV: UTF-8, comma separated, `\n` record ends, fields quoted only when they contain `,` `"` CR or LF, quotes doubled. Canonical text is never rewritten for spreadsheets; reviewer copies prefix cells starting with `= + - @` TAB CR with an apostrophe and say so in the validation report (the full export currently contains none).

Gzip members are produced by Node's zlib at level 6 with mtime 0 and no file name, so identical inputs on the same Node/zlib build give byte-identical files (the zlib version is part of the checkpoint identity).

## Commands

```
npm run reading-export -- build                       # cargo build --locked --profile export
npm run reading-export -- sample    --out DIR --start 0 --end 100000
npm run reading-export -- review    --out DIR [--reviewer-copies]
npm run reading-export -- full      --out DIR [--jobs 8] [--chunk-size 50000] [--cleanup]
npm run reading-export -- resume    --out DIR           # same flags as the interrupted run
npm run reading-export -- validate  --out DIR
npm run reading-export -- benchmark --out DIR --start 1000000 --end 1080000 --jobs 8
```

`full` and `resume` require a clean working tree for the export sources unless `--allow-dirty` (the dirty digest is recorded and is part of checkpoint identity). `--deck-size N` (<78) runs a tiny exhaustive deck for tests; it can only produce `toy-complete`. A `--start/--end` run can only produce `partial-sample`. Only the complete 78-card range produces `state: "complete"`.

`resume` reuses only chunks whose sidecar, size and SHA-256 verify and whose range matches; partial files are deleted and rebuilt. Killing the process at any time leaves no `manifest.json` and no logical `.csv.gz`. A second run against a directory with a different pack/version/chunk size/source stops with `EXPORT_CHECKPOINT_MISMATCH`.

## Architecture and bounds

Node orchestrates at most `--jobs` worker processes. Each worker spawns the Rust runner (`target/export/examples/reading-export batch --start --end`), reads one NDJSON line per case through a pipe (the pipe is the backpressure), renders 12 rows, and streams them to 12 gzip streams (`drain` honoured). Memory is per-case; nothing holds a chunk or the full result. The Rust runner never starts one process per case. `--stop-file PATH` asks the runner to stop at a case boundary. A broken pipe, a gzip/disk error or a runner failure aborts the chunk and deletes its partial files; errors name the case and context.

Assembly streams each chunk member into `<ctx>.csv.gz.partial`, verifying its SHA-256, and renames atomically. Disk preflight estimates need as chunks + assembled copy; `--cleanup` removes the chunks after the manifest is written.

## Validation

`validate-worker.mjs` independently gunzips and parses every file (separate CSV parser) and checks: header; exact row count; contiguous canonical `case_id` range; cards decoded from `case_id` (ids, names, orientations, distinctness); topic/intent; position roles/labels/lens; versions; no `{…}` placeholder, blank required section or unknown rule; evidence kinds match `rules.1.json`; fallback ⇔ no relations; UTF-8 validity; file and raw SHA-256 against the assembly record. It then compares the twelve files for identical case coverage and relation outcome, aggregates rule/fallback frequencies, and counts per case how many of the 12 contexts produce distinct text per section (identical text is legitimate). Finally a sample (edges, chunk boundaries, ~2,000 pseudo-random cases, plus the native/WASM fixtures in `tests/fixtures/readings.json`) is re-rendered through a fresh Rust runner and the production formatter and must equal the parsed CSV rows exactly.

Coverage levels are kept apart in the report: tested sample (`partial-sample`), verified full export (`complete`), and editorial review (never claimed).

## Review sets

`review` runs the Rust `scan` command over the range (all 12 contexts; it fails if relations ever depend on context), then deterministically selects cases:

1. Card coverage: rotating triples with all-upright and all-reversed masks cover every card × orientation × position; one-reversed-position triples add mixed orientations.
2. For every observed ordered rule pair (and fallback) the lowest case in each orientation class (upright / reversed / mixed).
3. For every remaining (rules × participating positions) signature, its lowest case.

Reasons also tag repetition/complement/tension, priority-ordered vs equal-priority tie-break pairs, singles and fallback. A rule that is never observed is reported as unreachable (only meaningful for the full range). Every review file contains the same cases in the same order, so one `case_id` can be compared across the 12 contexts.

## Storage and publication

Do not commit exported CSVs or copy them to `apps/web/public`. Keep them in a user-controlled location and publish nothing without explicit approval. The tool never uploads. Small evidence (manifest, validation report, benchmark JSON, sample rows) lives in `docs/validation/reading-export/`.
