# Candle artwork and runtime separation

The original candle artwork remains unchanged as a visual reference and flame source. `assets/sources/concept-additions/candle.png` is supplemental Imagegen artwork made from the user-supplied room concept on 2026-10-10, according to `scripts/import-assets.py` and `assets/manifests/art.json`; it is not asserted to be an independently supplied candle original. No broader redistribution license is inferred. No original was overwritten and no temporary attachment path is required.

| Asset | SHA-256 |
| --- | --- |
| `assets/sources/concept-additions/candle.png` | `8b81a07094ad4c3335af1dc1e842e2990ee9c77fe1c022a169d74700f6a0441a` |
| `apps/web/public/art/candle.webp` | `9d7b51bdd0ea32c57d8f7269012cd220e838e4891f292c3a3d204c19ca40021f` |

The existing import script converts the source to RGBA, resizes by nearest neighbour within 900 × 900, and writes lossless WebP, method 6. The runtime plate is 875 × 900 and 267,480 bytes. This work adds no texture download and preserves the shared source texture and its alpha edges exactly.

## Authored mesh and original flame

The user's follow-up on 2026-10-11 supersedes the original sprite-body requirement: body and holder are now original 3D meshes; only the original flame remains artwork. The source images above remain unchanged and provide the silhouette, wax colour and shallow brass saucer reference.

`packages/scenes/src/props/candle.ts` authors a closed 96-sided, 36-row wax surface with nine raised tapered rivulets, an irregular melted rim and recessed wax well. A lathed brass saucer includes its underside, rolled rim and raised candle socket; two rounded mouldings and a curved charred wick finish the prop. Wax and brass use light-reactive standard materials and cast/receive the lamp shadow. Wax alone bounds point-light near-field attenuation to an effective minimum distance of 0.6 world units, approximating a finite emitting region and diffusion instead of a point singularity at the melted well. This prevents the near wick surface from clipping under the room’s existing exposure. SpotLight response, room light intensity, anchors and global tone mapping remain unchanged; wax emissive is zero. The candle's own PointLight remains shadowless.

Two seeded 128 × 128 RGBA maps are generated locally by `paintedSurface`: wax uses vertical brush variation and fine stipple; brass uses low-frequency mottling and stipple. No external raster is used for these maps. SHA-256 of raw RGBA bytes:

- Wax: `58506b853b04691e0df90f290717c3f6a711fcf3a049a7bf850c15f105d452f2`
- Brass: `693f9abd16f33279204b1a88bd0aad7a6ec02c97301054a884f0254f5e1b3b46`

The flame is a camera-facing Sprite sampling only u=0.445–0.565, v=0.674–0.91 of the shared original plate. The alpha mask excludes the dark painted wick, which the curved mesh replaces. No body artwork or static flame is rendered behind it. Its pivot, wick tip and PointLight share the fixed anchor (0.004, 0.736, 0.012). Local +Y is vertical, base y=0, flame tip approximately y=1. The Sprite owns a cloned geometry so disposal never touches Three.js's global Sprite geometry. No second halo is added.

## Light and lifetime

A warm `0xffb55c` PointLight has base intensity 1.2, distance 2.5 and decay 2, with shadows disabled. Three.js parent scale does not scale light attenuation distance. Integrators position and size the whole prop in room units; changing `light.distance` is supported. Animation writes the defined intensity range every active update.

Two seeded smooth value-noise bands drive flame bend (≤0.065 radians), size (≤6%), opacity (0.91–0.99) and the same light intensity signal (1.098–1.302). Sampling uses absolute seconds, independent of frame rate. There is no per-frame random sampling, accumulating motion, color flash or moving light anchor. Reduced motion uses a steady flame and intensity 1.2. The optional third `update` argument pauses inactive scenes; runtime scene ownership must also stop inactive updates.

Each instance owns six geometries, five materials, two generated textures, five meshes, one Sprite and one shadowless PointLight. There are 15,118 submitted triangles and six colour-pass draws before scene shadow passes. The two generated maps use 131,072 CPU bytes and approximately 174,760 RGBA mipmapped GPU bytes; they add no download. One shared original texture lease supplies the flame. Disposal is idempotent. Cancellation is checked before and after asynchronous acquisition; late completion releases its lease before throwing. Factory failure disposes all resources created so far. The module imports no engine, state, birth data or private search values.

`tests/candle.test.mjs` verifies deterministic/continuous signal bounds, steady reduced motion, inactive pause, transformed anchor equality, volumetric body bounds, lit material and shadow flags, isolated Sprite ownership, late cancellation, load rejection and exactly-once resource disposal. Visual alpha/edge quality, lamp/candle interaction and real browser rendering require the integrated scene captures; unit tests alone do not qualify those gates.

## Captured inspection

The updated body was rendered and visually inspected in desktop headless Chromium at 1100 × 800 through production Storybook on 2026-10-11. Front, side and above show a complete volumetric wax body, saucer interior, raised drips, uneven melted rim and one camera-facing original flame. The bounded near-field response keeps the melted well and rolled lip legible under the PointLight, while the side surface preserves brush texture; lamp shadows remain anchored. No browser console or page errors occurred. Six Node tests passed, covering signal continuity, anchors, volumetric geometry and normals, documented texture hashes, shared/global ownership safety and exact cleanup and wax-only near-field attenuation. Typecheck passed. These isolated desktop captures do not assert mobile-device coverage.

- [Front](../validation/globe-lighting/candle-mesh-front.png)
- [Side](../validation/globe-lighting/candle-mesh-side.png)
- [Above](../validation/globe-lighting/candle-mesh-above.png)

`node scripts/capture-candle.mjs` refreshed the close, candle-only, reduced-motion, failure/retry and animation evidence for this mesh revision. The inspection context uses actual `prefers-reduced-motion: reduce`; canvas pixels were identical across 1.2 seconds. The separate animated context retains normal motion. Injected acquisition failure recovered through the visible retry action, and browser console/page errors were empty.

- [Lamp-on close](../validation/globe-lighting/candle-close.png) and [candle-only light](../validation/globe-lighting/candle-only.png)
- [Eight-second animation](../validation/globe-lighting/candle-animation.webm)
- [Reduced motion](../validation/globe-lighting/lighting-reduced-motion.png)
- [Failure](../validation/globe-lighting/lighting-asset-failure.png) and [retry](../validation/globe-lighting/lighting-asset-retry.png)
- [Machine-readable results](../validation/globe-lighting/candle-browser.json)
