# ADR 005: Exhaustive three-card reading export

Status: Accepted (epic #51)

## Decision

An offline, manually run tool exports every valid three-card reading as completed prose: 78 × 77 × 76 ordered distinct cards × 8 orientation masks × 12 topic/intent contexts = 43,819,776 rows. It is not part of the browser runtime, public assets or normal CI.

* **No second interpreter.** A Rust runner (`reading-export`, in the `pxoracle-tarot-reading` crate) installs the validated semantic/rule packs once and calls the production `Interpreter::interpret`. Text is produced by the production `composeReading`/`renderPhrase` in `apps/web/src/features/tarot/reading.ts`, which `ReadingResult.tsx` also uses.
* **Resume without touching gzip.** Work is split into fixed chunks of canonical cases. Each chunk writes twelve independent gzip members into `.export-work/`, then an atomic JSON sidecar with row counts and SHA-256 values. Final `<topic>-<intent>.csv.gz` files are the concatenation of a header member plus all chunk members (valid multi-member gzip). Nothing is ever appended at a guessed compressed offset.
* **Checkpoint identity.** `.export-work/identity.json` hashes the export schema, enumeration, deck, chunk size, input pack hashes, versions, source commit and dirty-source digest. A mismatch aborts (`EXPORT_CHECKPOINT_MISMATCH`) instead of reusing chunks; `--reset-work` discards them.
* **No false success.** `manifest.json` is written last, atomically, and only after assembly, review generation and the full independent validation pass. Until then the directory has no manifest (or a `validation-failed.json`). Ranges other than the full space, and reduced test decks, produce `partial-sample` / `toy-complete` states, never `complete`.
* **Human review is separate.** Automated gates are not editorial approval; manifests record `humanEditorialApproval: false`.

## Consequences

Large artifacts live in a user-chosen output directory outside git. Only the tooling, schemas, docs and small evidence are committed. See `docs/reading-export.md`.
