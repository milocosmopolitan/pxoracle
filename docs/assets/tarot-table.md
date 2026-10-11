# Tarot table artwork and rig

The supplied oracle inventory (`_assets/oracle/README.md`, talk, smile, look-down, table-gaze) contains expression/head changes on a fixed full-body master. It has no independently movable hand or forearm. No existing hand was cut out of that master.

Three new PNGs live in `apps/web/public/art/tarot-table/`. They are generated project artwork using the built-in OpenAI image_gen tool, 2026-10-10. The runtime PNGs are also the retained source originals. Dimensions, byte counts and SHA-256 provenance are in both art manifests. The user-supplied PXOracle concept was used as style reference for hand and surface; no redistribution license is inferred for that reference. Existing card face artwork is unchanged.

## Prompts

- **hand.png:** One elderly woman’s right forearm, dark indigo celestial knit sleeve, warm wrinkled skin, short nails. Overhead sprite, arm enters from top, fingers extend down, thumb/index gently pinch an invisible tarot card edge. Transparent padding, no card/body/table. Mature crisp pixel art, warm left light, violet right rim. Reference is character clothing/style only.
- **surface.png:** Orthographic overhead dark walnut tabletop, centered worn teal velvet mat covering 80% width and 85% height, narrow antique bronze double border. Warm left light/violet right rim. No props, hands, cards, writing, perspective, or legs. Flat landscape planar artwork for an oblique camera.
- **back.png:** Single straight-on deep teal tarot card back, antique bronze double border, symmetrical eight-point star, fine corner ornaments, worn pixel-art grain. No lettering/props/background padding; portrait 2:3.

## Runtime layout

The surface is a new 14 × 10 local XY plane, rotated -90° about X into the table plane. Its world anchor is (-3,-1,1). It is not the frontal desk image tilted to simulate another view. The camera moves from the frontal composition to (−3,9,10), looking at the table anchor: an oblique view, not vertical top-down. The existing frontal artwork fades as the planar surface enters the same scene.

The hand sprite occupies a 3.4 × 4.25 local plane. Its pinch contact is approximately normalized (0.59,0.78), mapped by a mesh offset (−0.306,1.19,0.03) relative to `handAnchor`. The secondary hand mirrors its UV horizontally. A two-segment mesh extends only the upper sleeve strip (UV top 0–34%) beyond the rear camera framing; wrist and finger proportions remain unchanged. Cards use a 0.94 × 1.42 plane; the held card center is (0,−0.6,−0.13) in hand coordinates. The hand renders in front of the held card, which renders in front of the mat. `Object3D.attach` transfers ownership with a world-preserving transform; tests sample both ownership boundaries.

## Scope and future art upgrades

This is a controlled 2.5D single-grip sprite choreography, not an articulated anatomical rig or physical shuffle simulation. The grip travels with a selected card, releases it at the spread, and follows its edge during turning. The second hand is mirrored, not a separately painted left hand. That is visible and reviewable in the independent production-scene Story.

For richer motion, author separate left/right sprites with identical normalized pinch anchors and sleeve width: rest-open, approach, pinch-closed, release-open, and turn-edge poses, each on a transparent 1122 × 1402 canvas. Preserve the same wrist/sleeve silhouette in frame transitions; do not crop hands from the frontal body. A two-frame thumb foreground overlay could place the card between thumb and fingers. These are optional fidelity improvements, not hidden placeholders in the current implementation.
