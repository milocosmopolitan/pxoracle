# Candle artwork and runtime separation

The candle body uses the existing repository artwork unchanged. `assets/sources/concept-additions/candle.png` is supplemental Imagegen artwork made from the user-supplied room concept on 2026-10-10, according to `scripts/import-assets.py` and `assets/manifests/art.json`; it is not asserted to be an independently supplied candle original. No broader redistribution license is inferred. No original was overwritten and no temporary attachment path is required.

| Asset | SHA-256 |
| --- | --- |
| `assets/sources/concept-additions/candle.png` | `8b81a07094ad4c3335af1dc1e842e2990ee9c77fe1c022a169d74700f6a0441a` |
| `apps/web/public/art/candle.webp` | `9d7b51bdd0ea32c57d8f7269012cd220e838e4891f292c3a3d204c19ca40021f` |

The existing import script converts the source to RGBA, resizes by nearest neighbour within 900 × 900, and writes lossless WebP, method 6. The runtime plate is 875 × 900 and 267,480 bytes. This work adds no texture download and preserves the shared source texture and its alpha edges exactly.

## Body and flame

`packages/scenes/src/props/candle.ts` separates the two pieces during rendering with complementary alpha masks sampling the same leased plate. The runtime body material suppresses the original flame pixels. The moving flame material retains only those pixels, so there is no static flame behind the animation. A dark wick is retained in the body. Coordinates are expressed in bottom-origin original plate UVs; the lower flame separation spans y=0.674–0.695 and the upper flame occupies y≥0.695. A cropped flame plane limits drawing to u=0.445–0.565, v=0.674–0.91. This is a code-native alpha separation, not a generated replacement or destructive raster edit.

The body remains a fixed world-space illustration. It does not rotate with the camera. Local +Y is vertical and +Z faces the artwork viewer. The visible foot is approximately y=0 and flame tip approximately y=1. The wick and PointLight share one fixed anchor at (0.004, 0.736, 0.012), including when the entire prop is transformed. The flame mesh pivots at that anchor. The original illustration already supplies its warm halo; no second halo billboard is added.

## Light and lifetime

A warm `0xffb55c` PointLight has base intensity 1.2, distance 2.5 and decay 2, with shadows disabled. Three.js parent scale does not scale light attenuation distance. Integrators position and size the whole prop in room units; changing `light.distance` is supported. Animation writes the defined intensity range every active update.

Two seeded smooth value-noise bands drive flame bend (≤0.065 radians), size (≤6%), opacity (0.91–0.99) and the same light intensity signal (1.098–1.302). Sampling uses absolute seconds, independent of frame rate. There is no per-frame random sampling, accumulating motion, color flash or moving light anchor. Reduced motion uses a steady flame and intensity 1.2. The optional third `update` argument pauses inactive scenes; runtime scene ownership must also stop inactive updates.

Each instance owns two geometries, two materials, two meshes and one shadowless PointLight; both materials share one texture lease. Disposal is idempotent. Cancellation is checked before and after asynchronous acquisition; late completion releases its lease before throwing. Factory failure disposes all resources created so far. The module imports no engine, state, birth data or private search values.

`tests/candle.test.mjs` verifies deterministic/continuous signal bounds, steady reduced motion, inactive pause, transformed anchor equality, complementary shader variants, shared texture identity, late cancellation, load rejection and exactly-once resource disposal. Visual alpha/edge quality, lamp/candle interaction and real browser rendering require the integrated scene captures; unit tests alone do not qualify those gates.

## Captured inspection

On 2026-10-11, desktop headless Chromium at 1100 × 800 rendered the production props through the persistent `SceneRuntime` in `Room/Production Lighting` Storybook. The close candle and lamp-on retry images were visually inspected: one flame remains attached to the wick, alpha edges preserve the pixel silhouette, and the actual warm light produces a localized tabletop pool and brass highlight. The isolated inspection table is a test surface, not a room-completion claim.

- [Candle close, lamp on](../validation/globe-lighting/candle-close.png)
- [Candle light, lamp off](../validation/globe-lighting/candle-only.png)
- [Continuous flame and light animation](../validation/globe-lighting/candle-animation.webm)
- [Steady reduced motion](../validation/globe-lighting/lighting-reduced-motion.png)
- [Injected asset rejection](../validation/globe-lighting/lighting-asset-failure.png) and [successful retry](../validation/globe-lighting/lighting-asset-retry.png)
- [Browser check results](../validation/globe-lighting/candle-browser.json): no page errors, reduced-motion canvas pixels identical across 1.2 seconds, injected acquisition failure recovers through the visible retry button.

The four targeted Node tests passed. Real-device/mobile and integrated room camera coverage remain separate qualification gates; these desktop isolated captures do not imply them.
