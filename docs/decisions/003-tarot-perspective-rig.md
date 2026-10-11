# ADR 003: Articulated mesh hands and phase-specific cameras

Status: camera frames accepted 2026-10-10; implementation revised 2026-10-11. The user approved the four fixed camera frames; character rendering remains subject to visual review.

The user rejected flat hand/arm sprites, mirrored anatomy, stretched sleeves and elbows constrained to the tabletop. Replace them with separately authored left/right skinned GLBs, fixed-length arm geometry and shoulder/elbow/wrist articulation. Elbows hang toward the body and can pass below the tabletop behind its rear edge. Table collision applies to surfaces, not an artificial elbow-height plane. Authored frontal and elevated armless torso plates avoid exposing cut sleeves or using a frontal face in a high view. Slim tapered sleeves replace spherical shoulder caps. Skin, cloth and wood use UV albedo/normal/roughness materials. Only limb meshes are selectively pixelated; source artwork retains its resolution. A complete mat texture replaces the cropped table image.

This supersedes ADR 002's combined hand image, orthographic/phase framing and sleeve extension details. Rust, controller, minimal Scene DTO, Zustand, DOM and asynchronous ownership boundaries in ADR 002 remain in force. All assets are local, lazy with the tarot Scene, with source/license and cleanup recorded.

A single three-dimensional table, mat and floor remain anchored through the sequence. Approved desktop elevations are 43° shuffle, 58° selection, 48° reveal, 55° reading. Mobile uses 47°, 65°, 52°, 60°. A 36° PerspectiveCamera settles before shuffle, widens with the fan, locks during selection, approaches the active reveal and frames the reading. Detail framing is user initiated and rises to 72° on desktop or 75° on mobile. Reduced motion and restore reach the equivalent settled view without long movement. Canvas bounds remain stable across phases.

The painted torso plus mesh limbs is a hybrid 2.5D character, not a full-body anatomical sculpt. Tiling skin/cloth maps supply material detail without claiming a bespoke knuckle/nail atlas. Choreography uses controlled paths rather than physics, and changes no engine result.

See [rig and Scene contract](../assets/tarot-table.md), [asset provenance](../../apps/web/public/art/hand-mesh/PROVENANCE.md), and [validation](../validation/tarot-table-v2/README.md).

The subsequent 2026-10-11 size review reduced card geometry to 75% (0.705 × 1.065) and the mat to 7.4 × 5.4. Physical cards no longer grow between stages. Closer shuffle/selection distances and smaller reading/detail framing provide magnification without changing approved elevations. Mobile fan and waiting spread positions remain inside the mat; automated projected-bound checks retain 44-pixel touch targets.

The spacing follow-up halves the empty horizontal and vertical gaps between fan cards, rather than halving center distances and overlapping them. Reading gaps also halve. Mat resizing preserves the rear edge nearest the character. A rounded cloth body casts contact shadows beneath the complete alpha-tested artwork; card resting heights clear its .045 surface. Darker, rougher wood and restrained warm fill bring the desk/floor closer to the painted room lighting.
