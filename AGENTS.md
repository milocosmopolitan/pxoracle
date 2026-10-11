# PXOracle implementation rules

Preserve the boundaries in ARCHITECTURE.md and docs/decisions/README.md. Use npm and Cargo lockfiles. Next.js must remain statically exportable to S3; client state belongs to the root Zustand provider. Never embed artwork or prose in WASM. Never replace real production calculations with unlabeled mock results.

Run meaningful checks for the changed boundary. Full integration: cargo test --locked; npm run wasm; npm run typecheck; npm run build; npm test; npm run build-storybook. Generate schemas after Rust DTO edits. Do not declare browser/device coverage from Node tests. Do not close qualification issues without evidence. Do not upload private questions or birth records to logs, URLs, analytics, or external services.

Scene preparation must tolerate abandonment; ownership cleanup must cover failures and stale completions. Keep engines separately loaded. Preserve the provenance and license of vendored C and user artwork.


## Tarot interpretation quality skill

Use `.agents/skills/improve-tarot-readings/SKILL.md` for review-CSV-driven editorial improvement of production tarot interpretations. Coordinate topic reviewers with the skill's delegation contract; keep shared-source integration under one owner. Claude Code can discover the same skill through `.claude/skills/improve-tarot-readings`.
