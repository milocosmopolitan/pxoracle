# Original bronze lamp

The production model is authored in `packages/scenes/src/props/lamp.ts`. No third-party mesh or material was used. Lathe profiles describe the turned, rounded multi-level foot, socket, closed fabric hems and finial. A swept Catmull–Rom tube forms the bent column. Independent exterior/lining surfaces give the broad flared shade physical thickness. Six fabric seams and a central support spindle join its assembly. A narrow finial socket and three support wires leave the upper aperture open for inspection of the lined interior. The downward-only spotlight cone prevents upward light leakage. The model bends toward local +X, matching the old room sprite's `flipX: true` orientation.

## References and provenance

The supplied original was recovered from `Work/projects/px-oracle/_assets/environment/Aged bronze desk lamp.png` and copied verbatim to `assets/sources/lighting/lamp-original.png`. Its SHA-256 exactly matches the existing asset manifest. The requested filename `Aged bronze desk lamp(1).png` was not found in the workspace, Codex attachments or accessible project source folders. Consequently no claim is made that a differently named attachment was inspected. Both the recovered original and the runtime reference were visually inspected.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `lamp-original.png` | 854838 | `9750153d605bb2a482ee2cae9d48145abd743b77b8fe31cb4913369466f346f7` |
| `lamp-runtime-reference.webp` | 342518 | `c5085d965026d8a45006b6a73585540f27029c79fa556bd31e64b5f0b6c48058` |

The source is user-supplied project artwork; no redistribution license is inferred. The runtime reference is a verbatim copy of `/art/lamp.webp`, previously imported by `scripts/import-assets.py` as a 900×900 lossless WebP from the 1254×1254 original. Neither reference bitmap is fetched by the new mesh. The durable copies preserve evidence without depending on the original workstation path.

## Reproduction and ownership

`createLamp` generates geometry and four deterministic 128×128 RGBA DataTextures for fabric color/relief and bronze color/relief. Their source is the arithmetic in `surface`, including a four-pixel weave and irregular quantized stippling. These are newly authored textures, not crops of the supplied artwork. Color maps use sRGB; relief stays linear. Nearest magnification preserves illustrated grain; mipmaps bound distant shimmer. Geometry and textures are reproducible from the checked-in TypeScript source, without Blender, image generation, or downloads.

Every material is light-responsive. Bronze uses subdued metallic response, relief and roughness variation. Fabric emissive color describes the visible shade glow; it does not provide room illumination. A separate fixed warm SpotLight at the bulb anchor illuminates actual receivers. A shadowless PointLight (intensity 3, range 7, decay 2) models restrained fabric transmission. This fill was added after actual room inspection showed nearly black nearby bronze and globe surfaces; it is fixed inside the shade and does not add a shadow pass. The point-source approximation excludes the small socket itself from shadow casting to avoid a disproportionate black socket disk, while the shade, stem and base remain casters.

Local coordinates: +Y up, base contact Y=0, height approximately 2.98, shade center X=.49, lower aperture Y=1.84. `bulb` and the SpotLight share their world position. The spotlight target is a child of the prop at (.65,-.08,.25), so camera movement cannot move the illumination. Scene integration is responsible for placing the whole group above its table, and for replacing previous warm lights.

Default downlight: color `#ffcb87`, intensity 24, range 10, decay 2, half-angle .79 radians, penumbra .65. Shadow map 512×512, near .12, far 10, bias -.0003, normal bias .015. `setShadows(false)` releases allocated shadow maps; reenabling permits lazy recreation. One shadow pass belongs to this light. Renderer shadow enabling and exposure belong to the shared runtime; this module never changes them.

`dispose` is idempotent and releases every local geometry/material/texture, shadow target and object attachment. No shared texture lease is acquired, since this assembly is generated locally. Preparation checks cancellation before allocation and before returning; failure after assembly invokes cleanup. The lamp is stationary and requires no animation or reduced-motion branch.

## Validation boundary

`tests/lamp.test.mjs` checks anchors through tarot-style parent rotation and camera motion, actual shade interior/hem geometry, material maps, table contact, bounded shadow settings, abort behavior and exact-once resource disposal. Browser visual evidence and measured draw/shadow costs belong to the integrated lighting review; these structural Node tests do not establish browser or device coverage.

The four tests passed on 2026-10-11. Direct production-assembly inspection measured 23 Mesh objects, 13,202 triangles, 7 materials and 4 textures with 262,144 bytes of source RGBA texels before mipmaps. These are object/geometry counts, not measured renderer draw calls or hardware GPU allocation. No lamp bitmap download is required. The generated resource counts and source hashes are recorded in `assets/sources/lighting/lamp-manifest.json`.

Actual Chromium production Storybook captures were inspected from [front](../validation/globe-lighting/lamp-front.png), [side](../validation/globe-lighting/lamp-side.png), [rear](../validation/globe-lighting/lamp-rear.png) and [above](../validation/globe-lighting/lamp-above.png). Inspection led to softer weave relief, lighter aged-bronze response, the open upper aperture with connected finial support, and restrained transmitted fill. All four final captures had zero console/page errors. They show tabletop contact, curved-stem joins, thick lower and upper hems, lined interior, stable contact shadows and warm/cool material response. These desktop Chromium views do not qualify physical mobile hardware.
