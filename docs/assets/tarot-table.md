# Tarot scene assets, rig and camera contract

The tarot Scene uses separate left/right skinned hands, fixed-proportion 3D arms, one three-dimensional table and a continuous floor. The old combined `tarot-table/hand.png` is historical source and is no longer loaded. Rejected sprite atlases are not shipped. Existing landing and astrology artwork is preserved.

## Ownership and data boundaries

Rust/WASM alone fixes the deck, selections, orientations and reading references. The controller serializes commands and commits the engine response before starting choreography. Zustand stores the engine session and discrete presentation state. Scene receives only anonymous visible slots, confirmed selections, available face URLs, phase/revision and intent/event callbacks. It never receives a question or the hidden deck. `readingFocus` is a presentation-only card index and is not saved in the engine session. Per-frame camera, wrist, elbow and card transforms stay in Scene.

`reviewShot`, `reviewProgress`, `handPose` and legacy `cameraProfile` are independent Storybook review overrides; production does not set them. Revision guards, scene AbortSignal and face-load generations reject stale completion. GLB fetches, textures, materials, geometries and skeleton bone textures are owned and cleaned up on failure, replacement and unmount.

## Character and UV materials

The armless `hand-mesh/oracle-front-v4.png` and `oracle-oblique-v4.png` reconstruct the torso through the hips so raised arms do not uncover painted sleeve stumps. They retain the user's character identity as two authored views, blended by camera elevation. The hips remain behind the table while the upper body reaches. They remain 2D layers. Both arms and all five fingers on each hand are 3D. Exact [generation prompts](tarot-material-prompts.md) are retained. Source models, license, hashes, material generation specifications and UV ownership are recorded in [PROVENANCE.md](../../apps/web/public/art/hand-mesh/PROVENANCE.md).

Each GLB has 25 weighted joints. Flat WebXR joints are reparented with world-preserving transforms into wrist/finger chains. Anatomical left/right assets and corresponding coordinate rotations replace sprite mirroring. Rest, support, packet, pinch and release use articulated poses; thumb opposition is calibrated separately for each hand. Pinch tip centers straddle a .10-unit gap. Finger targets and contact offsets blend during normal motion. The wrist frame keeps a stable forward direction near vertical forearms; normal playback limits adjacent wrist rotation. The elbow solver stays on its downward hemisphere and retains a continuity penalty even when a grip stops moving. Idle arms follow the body lean.

The upper arm is 2.2 units and forearm 2.1, with fixed geometry. An analytic two-link solution chooses the elbow toward the side of the body. **There is no elbow-to-table-height constraint.** Elbows may hang below the tabletop behind its rear edge. Actual forearm/table intersection and deformed hand surface height are checked separately. Wrist orientation follows the forearm and palm rotation follows the card during a reveal. Both shoulders and the torso move together for forward and lateral reaches. The upper sleeve is tapered to a .36-unit shoulder radius and has no separate spherical shoulder cap. Tests exercise all twelve visible slots and all three destination positions in desktop/mobile layouts without limb stretching.

Skin and cloth have generated albedo textures applied through UVs. Hand topology/weights/UV islands are preserved; forearms and sleeves have cylindrical UVs. Skin, cloth, mat and wood use MeshStandardMaterial with UV normal and roughness maps. Technical relief maps are generated as small DataTextures from periodic weave, pore and grain height functions, not baked light/shadow. Warm desk light, cool window fill and a shadowed key light share the same space. This remains a hybrid character, with generic hand topology and a painted torso, not a fully sculpted elderly body or physically simulated cloth.

## Table and cards

Table origin is (−3, −1, 1); local XY is rotated −90° about X. The 14 × 8.4 top, apron and four legs are one object composition in conversation and close shots. The mat measures 9.4 × 6.0 at height .035; the 80 × 80 wooden floor continues underneath. The room billboard supplies only its wall section, removing the painted-floor conflict.

The dedicated transparent `hand-mesh/reading-mat.png` supplies the complete mat including all four stitched edges; its UVs use the whole image. The earlier table-image crop is no longer loaded. Separate albedos derived from the original `room.webp` floor and `table.webp` tabletop cover the continuous floor and rounded desk. Floor UVs repeat six times across 80 units; the desk uses one complete tile. Runtime roughness and subtle grain normals retain warm/cool lighting without blurring the source pixel texture. `back.png` is shared by all card backs. Only twelve anonymous slots and up to three confirmed cards are rendered. Selected faces are requested individually before reveal, with same-card retry. A card attaches to the acting hand anchor on pickup and returns to the table with world-preserving ownership. Card face flip and reversed in-plane rotation are separate. Reveal lift accounts for the card's scaled half-width, keeping its turning edge above the mat. Shuffle lifts the supported deck, moves a packet and lowers it before the fan opens. Reveal rolls a card toward its balance point, releases the grip, then lets the card settle; the wrist no longer follows a full 180-degree turn. Pickup/place takes 2.4 seconds and reveal takes 2.6 seconds, allowing the hands to retreat behind the selectable cards without abrupt joint motion.

## Approved cameras and timing

The user approved four fixed frames on 2026-10-10. Desktop elevations from the table horizontal are 43° shuffle, 58° selection, 48° reveal, 55° reading; mobile is 47°, 65°, 52°, 60°. All use 36° vertical perspective FOV. The table, mat and deck are stable world anchors.

Conversation approaches the shuffle frame over 2.4 seconds and settles before shuffle acknowledgement. Shuffle camera holds. The .8-second fan widens the view, and selection retains exactly that camera despite hover, keyboard focus or revision changes. The active reveal gets a short .55-second approach. Reading pulls back over .85 seconds. DOM controls explicitly choose a detail card or return to the overview; there is no idle orbit. A restored session initializes directly in its appropriate frame. Reduced motion uses the final pose immediately.

Canvas bounds do not resize at phase transitions. Desktop reading reserves the right side through camera framing. Mobile uses a stable upper scene region with controls and a collapsible meaning panel below, leaving selectable cards in the remaining region. Mobile uses a four-column page and three rows; desktop uses six columns and two rows. All 78 anonymous slots remain available through DOM pagination.

## Selective pixel presentation

Only mesh limbs carry `userData.pixelate`. The tarot Scene owns a low-resolution color target, a low-resolution depth-tested selection mask and a full-resolution art target. The background pass excludes the limbs while retaining their cached shadows; the composite restores only the masked pixelated limbs. Face, room, mat and card artwork remain at display resolution. The mask respects intervening geometry, alpha-tested artwork and card depth. Desktop limb pixels are 2 CSS pixels; mobile uses 1.5. DOM remains outside the renderer.

`SceneInstance.render` is an optional runtime hook; other scenes keep their existing render path. Targets, mask materials and directional shadow maps are disposed with Scene ownership, and render-target/material/visibility state is restored even if rendering throws. Tests cover this failure path and continuous choreography frame-to-frame, in addition to fixed poses.

See [validation evidence](../validation/tarot-table-v2/README.md). Browser emulation does not qualify physical devices or character likeness.

## Card size and mobile clearance

Cards are 0.705 × 1.065 world units, exactly 75% of the previous 0.94 × 1.42 size. Their physical size is constant in every phase; selected cards no longer grow during reading. Camera distance provides magnification. The mobile four-column, three-row fan fits inside the smaller mat with a rear-edge margin. Projected card bounds are checked at 390 × 540 and 390 × 590, including a minimum 44-pixel target in each axis. Idle hands retreat behind the fan. Approved camera elevations remain unchanged; shuffle and selection distances are closer, with reading/detail framing adjusted to the smaller spread.

## Shoulder, cuff and reading interaction revision

The portrait's frontal/elevated shoulder landmarks interpolate with the same view mix as the artwork, then transform through the torso and table matrices into rig attachments. Both arms consume these anchors instead of retaining fixed shoulder positions. A cloth-covered elbow overlaps a closed, forearm-aligned rolled cuff so bending cannot expose an open sleeve mouth. The support hand follows a smaller coordinated path while the packet hand makes the larger movement around the table center.

Revealed cards have a 1.0-unit center spacing and deterministic placement variation, at most 0.048 radians and 0.045 units. The selected slot/index determines the small variation; no engine randomness or private question enters rendering. Restoring a reading preserves it. One-card and three-card camera framing use different extents. Desktop framing reserves the actual 380-pixel reading-panel region. A raycast hit on an exposed face emits `inspect` with its selected slot; the DOM controller maps it to `readingFocus` without an engine mutation. Hover never starts a camera move. Equivalent DOM buttons and a return-to-overview control remain available.
