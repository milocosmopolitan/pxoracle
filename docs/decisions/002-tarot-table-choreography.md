# ADR 002: engine-confirmed tarot table choreography

Status: accepted implementation, 2026-10-10. Rendering/character details are superseded by [ADR 003](003-tarot-perspective-rig.md); controller, engine and privacy boundaries remain in force.

## Decision

Keep Rust authoritative for shuffled order, orientations, selections, reading references and validation. Reveal commands now reject an incomplete spread and out-of-order unrevealed indices; idempotent replay and legacy valid saved results remain supported. DTO schema is unchanged. No rendering or prose enters WASM.

`TarotController` serializes engine commands and owns presentation progression in the root Zustand store. `TarotView` is a projection containing anonymous visible slot numbers, selected-card face URLs/orientation/reveal flags, phase/revision, focus/page, and intent/event callbacks. It never includes the hidden deck, seed, engine session, question, or frame coordinates.

Three.js owns a table anchor, two hand sprite anchors, Mesh cards, raycasting, camera framing, timelines, texture leases and cleanup. Twelve anonymous slots are shown per page (six on the last page), preserving access to all 78 slots with sufficiently separated mobile targets. DOM provides equivalent numbered controls, focus highlighting, forms, status and reading text. No DOM card faces or canvas card-selection overlay is used.

## Progression

`conversation → approach → shuffle → fan → selecting → dealing → preparing → revealing → reading`

Dealing returns to selection until enough cards are confirmed. Preparing loads only the next selected face; only its successful ready acknowledgement can ask the engine to reveal. Revealing repeats in selection order. A revision tags every acknowledgement. Stale replies after disposal/navigation are discarded. A restored session enters selecting, preparing or reading directly without replaying shuffle/deal. A new reading clears the question and returns the camera to conversation.

The engine result is committed before dealing. Animation cannot draw another card. Reshuffle is available only before the first selection. Failed face loading offers a retry for the same selected face. WebGL failure retains explicit text-only progression controls. Reduced motion reaches the same state with immediate positioning and no long camera travel.

The table and cards share fixed local coordinates during the camera approach. Original frontal artwork and newly authored planar table art crossfade in one scene while camera position, target and framing change. The camera remains oblique. Mobile uses four columns and desktop six, with a separate DOM area below/beside the canvas. Pointer movements greater than eight CSS pixels cancel a selection gesture.

## Ownership and failure

Controller unmount invalidates outstanding commands; page return derives a settled presentation from the retained engine session. Runtime disables old-scene picking as navigation starts. Each scene holds shared texture leases and local geometry/material ownership. Pending face loads release themselves if ownership is stale; face textures no longer used by the reading are released. At most selected faces are requested, never all 78 upfront. Reduced-motion render-on-demand is invalidated when an image finishes loading.

## Alternatives

DOM cards were rejected because they cannot share hand/table coordinates or raycasting. A full physics simulation and skeletal character rig were rejected for this delivery in favor of testable timing and controlled paths. A single cropped frontal table was rejected for the oblique view; a dedicated surface was generated. Full 78-card overlap was rejected for mobile target size.

## Content and persistence

English `en.v1` keeps stable IDs and meaning-reference keys; its authored revision now has 156 distinct upright/reversed reflection prompts. Position prompts and a transparent structural synthesis link cards to focus/situation/examination/next action. This does not analyze the question or produce personalized AI narration. Only explicit save writes a session, excluding question text; restore validates through WASM and delete removes the saved record.

## Evidence and limitations

See [validation](../validation/tarot-table/README.md), [asset specification](../assets/tarot-table.md), and production-scene stories under `PXOracle/Tarot table`. Single-pose hands are documented explicitly. Browser emulation is not physical-device qualification. Existing deployment and independent-engine boundaries remain unchanged.
