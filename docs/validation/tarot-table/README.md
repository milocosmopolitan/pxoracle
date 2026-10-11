# Tarot table implementation evidence · 2026-10-10

## Implemented behavior

The real Rust/WASM deck is confirmed before shuffle choreography; each chosen slot is committed before its Mesh moves. One/three-card spreads, optional reversals, pre-selection reshuffle, paged access to all 78 slots, raycast picking, keyboard highlighting, ordered reveal, authored readings, explicit save/restore/delete and new-reading return are connected end to end. Questions stay in memory and are not interpreted or transmitted.

The production scene uses one camera and a fixed table anchor for conversation → oblique approach → shuffle → fan → selection → pick/place → reveal. It has a dedicated overhead surface and independent transparent forearms. Card faces and reversals use separate rotation axes. No DOM card faces are used. See [ADR 002](../../decisions/002-tarot-table-choreography.md), [scene contract](../../contracts/README.md), and [art provenance / pivots / limitations](../../assets/tarot-table.md).

## Required checks

- `cargo test --locked`: 11 native tests pass, plus doc tests. New coverage rejects incomplete and out-of-order reveals without changing the session.
- `npm run wasm`: both independent engines built with pinned Emscripten 4.0.10.
- `npm run typecheck`: pass.
- `npm run build`: pass; `/`, `/tarot/`, `/astrology/` remain static exports.
- `npm test`: 24 pass. Controller tests cover engine-before-animation, duplicate commands, stale events, abandonment, restore and minimal scene data. Scene tests cover world-position continuity, separate flip/reversal axes, late texture disposal and late manifest delivery. Existing parity, ownership, schema and content checks remain enabled.
- `npm run build-storybook`: pass.
- `node scripts/check-boundaries.mjs`: pass. Rust DTOs did not change, so no schema regeneration was needed.

## Browser and Storybook checks

`npx playwright test`: **37 passed, 3 intentional skips** across Chrome 154.0.8037.98, Firefox 142.0.1, WebKit 26.0, and Pixel 7 Chromium 141.0.7390.37 emulation. The skipped cases are the desktop-Chrome-only allocation benchmark on the other three projects; all functional cases pass locally. [Recorded browser versions](browsers.json).

The app tests run on exported HTML with real WASM, not Node rendering mocks. `tests/browser/tarot-table.spec.ts` exercises selected-face-only loading, forced face failure and identical-URL retry, 1/3-card readings, restore/delete, standard-motion camera progression, keyboard focus/Enter, cancellation during dealing, one surviving canvas, raycast clicks/taps and drag rejection. `tarot-fallback.spec.ts` deliberately disables WebGL and verifies DOM progression, question clearing, no question in requests, and no question in saved state.

The standalone Storybook suite passes all three tests: existing isolated production stories, three HMR replacements without additional scene listeners, and the eleven tarot states including repeat camera transitions. Storybook is labeled synthetic and makes no engine requests. Test servers use dedicated ports 6106/6107 to avoid a user's running development server.

Commands:

```sh
npx playwright test
npx playwright test --config playwright.storybook.config.ts
```

The Safari smoke script is updated for automatic reveal. New native Safari qualification is left to the existing macOS CI job; earlier Safari qualification is not represented as evidence for this change. No physical mobile or screen-reader audit is claimed.

## Visual evidence

- [Hand carries the Mesh card](hand-carry.png), [placed and revealed](hand-revealed.png): independent production-scene Story, 1100 × 800, normal motion. The carry capture is 900 ms after replay.
- [Desktop selection](desktop-selection.png), [desktop three-card reading](desktop-three-card-reading.png), [one-card reading](desktop-reading.png).
- [Mobile selection](mobile-selection.png), [mobile three-card reading](mobile-three-card-reading.png), [one-card reading](mobile-reading.png): Pixel 7 Chromium emulation. Capture pixels include device scale; this is not a physical phone.

All screenshots were inspected for mat framing, hand/card contact, visible selection targets and DOM/Canvas separation. Manual desktop Chrome inspection supplemented automated browser tests.

## Deliberate limits

The hands use one generated grip pose and a mirrored secondary hand. An extended upper sleeve prevents a detached wrist when reaching across the table; fingers do not articulate. This is a controlled 2.5D choreography, not a complete skeletal character rig. Optional richer pose specifications are in the asset document.

The 156 upright/reversed prompts are distinct authored reflections, linked to card identity, orientation and spread position. The overall reading combines those themes with a disclosed structural reflection exercise; it does not analyze the user's question or claim personalized AI interpretation. Editorial review remains appropriate before a commercial launch.

No AWS deployment, qualification-issue closure, or claim of physical-device performance is included. Existing room/door/art composition changes present in the working tree were preserved as the visual foundation; unrelated ignore/lockfile edits are excluded from this PR.
