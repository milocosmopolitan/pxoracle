# Articulated tarot table validation · 2026-10-11

This revision replaces the sprite hands from [the earlier implementation](../tarot-table/README.md) with separate left/right 25-joint hand meshes, fixed-length articulated arms and a single perspective table. The earlier report is historical evidence, not a qualification of this revision.

## Rendering changes

- Downward elbow solutions can remain below the table behind its rear edge. Forearm surface collision and deformed hand vertices enforce clearance. Continuous wrist/elbow tests cover approach, overhand shuffle, fan, pickup, release and reading; all twelve visible slots and three destinations are swept on desktop and mobile layouts.
- Closed rolled cuffs overlap cloth elbow joints so bent sleeves do not expose an open seam. Shoulder attachments interpolate the same frontal/elevated landmarks as the torso, including its lean. Slim sleeves replace spherical shoulder caps. New frontal/elevated armless torso artwork aligns with the shoulder anchors. These are authored view plates, not a fully modeled head/body.
- Skin and cloth use UV albedo, normal and roughness materials. The floor and tabletop use separate textures derived from the user's original `room.webp` and `table.webp`; the full mat retains all four stitched borders. Original artwork is unchanged.
- Only limb meshes are pixelated through a depth-tested mask. Face, room, wood, mat and cards render at display resolution. Cleanup covers all three targets, mask materials, geometry, shadow maps, GLB skeletons and texture leases.
- Approved phase cameras settle for shuffle and selection, follow the reveal, then frame all reading cards. Exposed card Mesh clicks/taps and equivalent DOM controls offer a focused card view and return to overview; mobile descriptions collapse below the canvas.

## Spacing and surface follow-up

The card-to-card empty gaps are now 50% of their former horizontal/vertical spacing. The mat is 7.4 × 5.4, with its character-side edge fixed at local Y=3; a thin rounded cloth body casts shadows below the complete artwork. Tests check the anchored edge, physical thickness, card clearance and mobile touch bounds. Selection/reading cameras move closer; card detail rises from 55°/60° to 72°/75° on desktop/mobile. Table/floor albedo multipliers, roughness and warm fill are subdued to match the dim painted room. The follow-up reran 35 Node tests, 14 focused Scene/rig checks, typecheck, static export, Storybook build and ownership-boundary checks successfully. All six real static-app desktop/mobile browser checks pass again. Twelve tarot/fixed-frame Storybook checks also pass; the full 15-test result below belongs to the preceding revision. After the final mat-edge inset, the stage/detail-frame and animated hand browser checks were rerun: both pass, and their screenshots are refreshed.

[Desktop detail](frames/desktop-detail.png) · [Mobile detail](frames/mobile-detail.png)

## Card finish follow-up

Card faces and backs now write depth rather than depending on transparent draw ordering. A hollow focus outline follows the lifted card, and the fixed selection story highlights a nearer-row card to expose overlap regressions. The front shader clips the original art's exterior fringe; paper caps no longer fill transparent corners. The lower nameplate uses the selected card's public name, rendered as a local serif CanvasTexture on the face Mesh.

Detail-only soft gold particles surround the card and sit behind the inscription. The reduced-motion test verifies stable particles, normal-motion updates and resource disposal; depth-write assertions guard the occlusion regression. No hidden deck or question data is added to the Scene. Current detail captures show the name and clipped frame. This follow-up passes 36 Node tests, all six desktop/mobile app browser tests, twelve tarot Storybook checks, typecheck, static export, Storybook build and boundary checks.

## Knit, glow and instancing follow-up

A separate tarot-only shawl now has open front drapes, a .056-unit inner/outer separation, rounded hems, broad folds, shoulder pins and damped motion. Existing sleeves retain their dimensions. The portrait and cloth share shoulder anchors; amber shoulder lighting supplements the existing warm/cool scene lights. The heavy-knit reference comes from the user's front/profile/back images. Landing and astrology are unchanged.

Detail particles use independent smooth-noise drift. A selective, depth-occluded glow pass highlights particles and gold outlines without blurring the artwork. The anonymous fan/shuffle cards render in three instanced surface batches; confirmed cards remain independent Meshes. Tests cover instance-slot picking after pagination, selected-slot removal, final-page bounds and buffer disposal.

Current code passes 38 Node tests, typecheck, static export, Storybook build and ownership checks. The initial software-renderer Storybook attempt failed cold-load and animation deadlines; a GPU Chrome attempt also exceeded the combined ten-frame test/readiness budget. These failures are retained as qualification limits, not presented as passing performance tests. Frame capture now allows 300 seconds for ten cold Scene loads, with each readiness wait capped at 45 seconds. Animated replay still has its separate 20-second completion check after readiness. The GPU retry completed all ten screenshots but failed the console assertion on an unrelated missing Storybook favicon; an explicit empty preview favicon removes that request. After fixing the favicon and reducing the focus-ring width/brightness, the fixed-frame test passes with all ten desktop/mobile captures refreshed. Eleven other tarot browser stories pass on this revision, including live hand/camera playback, mobile, retry, restore and reduced motion. The current browser runs use the installed Chrome channel on the existing static servers (Storybook 6108, app 4174), with the same checked-in assertions and Pixel 7 emulation for mobile. Hardware Chrome reports Apple M4 Metal; no hardware FPS or physical-device qualification is inferred.

The final exported-app run also passes all six desktop/mobile checks with real WASM after instancing, knit and glow changes; the six app screenshots are refreshed.

Ammo and baked lighting were evaluated as options, not added. No claim of measured FPS improvement or new baked lightmaps is made. See the [performance decisions](../../assets/tarot-table.md#repeated-cards-and-performance-decisions).

## Checks

- `cargo test --locked`: 11 pass, plus doc tests.
- `npm run wasm`: pass, both independent engines, pinned Emscripten 4.0.10. Existing upstream C warnings remain.
- `npm run typecheck`: pass after the static build. An earlier concurrent run raced Next's generated type-directory replacement; the sequential rerun passes.
- `npm run build`: pass, static export preserved.
- `npm test`: 38 pass, including 17 rig/Scene checks for constant 75% card dimensions, mat containment, 44-pixel mobile targets and continuous joint motion.
- `npm run build-storybook`: pass.
- `node scripts/check-boundaries.mjs`: pass.

## Actual browser validation

`npx playwright test tests/browser/tarot-table.spec.ts --project=chrome --project=mobile-chromium-emulation`: **6 passed**, on the static export with real WASM. Coverage includes pre-selection reshuffle, same-card texture failure/retry, bounded face loading, one/three-card reading, local save/restore/delete, route cancellation, DOM keyboard parity, drag rejection, actual Mesh click/touch selection, and clicking/tapping an exposed card to enter detail framing and return to overview.

The initial scene-readiness assertion allows 45 seconds: a preceding mobile cold-load run reached selection just after its former 20-second budget. This is functional browser validation, not a latency or physical-device benchmark. Reading captures scroll to the page top so a fixed canvas is not misleadingly displaced in a full-page screenshot.

`npx playwright test -c playwright.storybook.config.ts`: **15 passed** in Chromium. Coverage includes desktop/mobile fixed phase frames, camera comparisons, hand pickup/place/flip, the full camera sequence, upright/reversed and three-card readings, failure/retry, restoration, reduced motion and HMR cleanup. Node tests are not browser coverage.

## Review surfaces

- [Conversation](conversation.png), [camera approach](approach.png), [hand carry](hand-carry.png), [revealed card](hand-revealed.png).
- Fixed desktop: [shuffle](frames/desktop-shuffle.png), [selection](frames/desktop-selection.png), [reveal](frames/desktop-reveal.png), [reading](frames/desktop-reading.png).
- Fixed mobile: [shuffle](frames/mobile-shuffle.png), [selection](frames/mobile-selection.png), [reveal](frames/mobile-reveal.png), [reading](frames/mobile-reading.png).
- Real exported app: [desktop selection](app/desktop-selection.png), [mobile selection](app/mobile-selection.png), [desktop reading](app/desktop-reading.png), [mobile reading](app/mobile-reading.png), [desktop three-card reading](app/desktop-three-card-reading.png), [mobile three-card reading](app/mobile-three-card-reading.png).

Storybook fixtures are explicitly synthetic, with no WASM requests. App captures use the real WASM engine. Fixed stories freeze at a specified timeline sample for reproducible review; the full sequence and hand story animate normally.

## Limits

The character is a painted torso plus generic rigged hand topology and procedural arms, not a bespoke elderly full-body sculpt. The added shawl is a constrained heavy-knit drape, not a complete collision-aware garment simulation. Skin UVs tile a material rather than painting anatomically specific nail/knuckle regions. The generated textures derive from the original artwork; they are not byte-identical extracted pixels. Their references, exact prompts and license/provenance are in [asset documentation](../../assets/tarot-table.md) and [generation prompts](../../assets/tarot-material-prompts.md).

Readings remain authored card/orientation/position reflections; they do not analyze the question. No physical-phone, screen-reader, native Safari, new Firefox/WebKit qualification or hardware FPS claim is made by these checks. No AWS deployment or qualification-issue closure is included. Visual approval remains the user's decision.
