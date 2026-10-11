# Validation ladder

Run from repository root. Inspect current commands before execution and record exact results.

1. Audit existing reviews and preserve a baseline outside the repository. Add regression cases for accepted defects (context dispatch, reversal/coherence, fallback), plus unchanged controls. Tests must assert meaningful production behavior, not merely increased unique-string counts.
2. For content changes, run python3 scripts/build-reading-content.py and then python3 scripts/build-reading-content.py --check. Inspect both source/public pack diffs. For DTO changes regenerate schemas/types. Update intentional versions across consumers.
3. Run cargo test --locked -p pxoracle-tarot-reading; run WASM crate tests when dispatch/contracts change. Inspect tests/evaluation.rs, tests/export.rs and tests/reading*.test.mjs. Generate fixtures using node scripts/build-reading-fixtures.mjs only after reviewing the expected plan differences.
4. Run npm run reading-export -- sample --out <NEW_DIR> --start 0 --end 1000, then npm run reading-export -- validate --out <NEW_DIR>. This is a small canonical range, not representative coverage. Review supplied anchor cases separately through the native evaluate example and production renderer; inspect its CLI rather than inventing --case-id flags.
5. Generate the representative review using npm run reading-export -- review --out <NEW_REVIEW_DIR> --reviewer-copies when resource budget permits. This scans the full case range by default: schedule it once after consolidation rather than per agent. A reduced --start/--end run has reduced coverage and must be labeled so.
6. Audit newly rendered review CSVs and compare identical case/context keys against baseline. If representative selection changed, report unmatched cases and explicitly re-render the original anchors; do not compare only a convenient intersection. Inspect actual phrase references and text, not just the summary metrics.
7. Follow root AGENTS.md for changed-boundary integration: npm run wasm, npm run typecheck, npm run build, npm test, npm run build-storybook; native full cargo checks as appropriate. Do not claim live WASM/browser parity from native fixtures. Record missing emcc or other prerequisites as blocked. Use CI evidence when available and tie it to the tested revision.

The CSV audit has its own checks:
python3 -m unittest discover -s .agents/skills/improve-tarot-readings/scripts -p 'test_*.py'

Keep export-complete, production-parity, agent-editorial-review and human-editorial-approval separate. A green export validator proves faithfully rendered output, not good interpretation. Do not mutate earlier manifests or historical approval fields. Keep source changes and small synthetic findings in git; keep full/review exports and local audit outputs outside git unless the user specifically requests a small evidence subset.
