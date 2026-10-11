# Current-app integration of reading.en.1.1

The reviewed interpreter and authored sources are integrated into the primary checkout, including the existing development app at `http://localhost:3000/tarot/`. This is a local source/build integration, not a GitHub merge or AWS publication.

## Active contract

Schema `1`, engine `reading.2`, semantics `semantics.2`, rules `rules.2`, prose `reading.en.1.1`.

Rust defaults and generated schemas, TypeScript contracts, Worker validation and pack loading, production prose loading, Storybook, fixtures, export tools and deployment checks all use this tuple. The content generator reproduces the source/public packs from authored TSVs. Both feature WASM artifacts were rebuilt with Emscripten 4.0.10; the interpretation remains inside the independently loaded tarot engine.

The 2,876 strings are byte-identical to the reviewed candidate's strings. Only its prose version label changed from `reading.en.2` to the requested `reading.en.1.1`. Historical editorial evidence retains its original hashes and version labels. [Current artifact hashes and sizes](integration-1.1-artifacts.json) and [18 production-rendered examples](integration-1.1-examples.json) describe this integration.

## How to view

Reload `/tarot/` to discard an already-running old Worker. Start a three-card reading, choose a topic and intention, then shuffle, select and reveal. The whole reading, connections, action, question and card details now use the improved interpreter and prose.

An older saved interpretation keeps its exact cards and perspective. Choose **Reinterpret these cards with current content** to update the text, then explicitly **Save reading** to update storage. One-card reflections continue using their separate existing content.

## Verification

- `cargo test --locked`: 35 tests passed.
- `npm run wasm`: passed with Emscripten 4.0.10.
- `bash scripts/generate-schemas.sh`: passed; generated contracts include the new tuple and nested topic/intent references.
- `python3 scripts/build-reading-content.py --check`: 156 meanings, 21 rules and 2,876 references passed.
- `npm run typecheck`, `npm run build`, `npm run build-storybook`: passed.
- `npm test`: 66 tests passed, including native/WASM equality for 174 inputs, all card orientations, frozen fixtures, old-pack SHA-256 preservation, intent selection and save compatibility.
- `python3 -m unittest discover -s tests/deployment`: 8 tests passed. This does not publish a release.
- Current-app browser tests: all 6 passed on Chrome desktop and Pixel 7 Chromium emulation. Covered draw/reveal, content failure/retry with unchanged cards, private-note exclusion, save/restore, legacy perspective, corrupt saves and explicit release-1 reinterpretation followed by Save.
- Storybook browser test: passed across 11 reading states, including all 12 perspectives, fallback, reversals, retry, keyboard and legacy versions.

The browser run targets the user's existing `localhost:3000` app, rather than an editorial worktree on another port. Raw logs and browser artifacts are under `~/pxoracle-exports/reading-1.1-integration/`. Browser coverage is for the HTML reading/engine workflow; it does not qualify 3D scene appearance or physical mobile hardware.

## Preserved changes and limits

Existing local `.gitignore`, `.ignore`, `apps/web/AGENTS.md` and `next-env.d.ts` changes were preserved byte-for-byte. The pre-existing empty generated `reading-input.json` was backed up under that evidence directory's `original/` tree before regenerating the required schema. Scene, camera, hand rig and draw-engine sources were not changed.

The [editorial limitations](README.md#remaining-limits) still apply: relationship synthesis uses shared theme clauses, and agent review is not human editorial approval. No runtime LLM, private-note analysis or remote interpretation service was introduced.
