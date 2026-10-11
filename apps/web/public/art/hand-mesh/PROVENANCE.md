# Hand models and generated character materials

The original `left.glb` and `right.glb` are vendored without modification from [immersive-web/webxr-input-profiles](https://github.com/immersive-web/webxr-input-profiles/tree/f4992299601614adbfefd398dc8e281556bb7444/packages/assets/profiles/generic-hand), commit `f4992299601614adbfefd398dc8e281556bb7444`. `LICENSE.md` is the package's MIT license, Copyright 2019 Amazon, and applies to these two models. Runtime articulation preserves their topology, UVs and skin weights.

Skin/cloth albedos were created with the built-in image_gen tool on 2026-10-10. Frontal/elevated body plates, walnut albedo and the complete mat were created on 2026-10-11 for PXOracle. They are separate project artwork, not part of the upstream MIT model package. `oracle-front-v4.png` derives from the user's existing `public/art/oracle.webp`; that original is unchanged. `oracle-oblique-v4.png` is an authored elevated view of that new plate. Skin, cloth and walnut are generated tile materials. `reading-mat.png` derives from the project's `tarot-table/surface.png`, preserving the complete stitched border and removing its wooden surround. There is no runtime image-generation service or external asset request.

## Generation specifications

- Torso: preserve the exact face, glasses, silver bun, moon necklace and light direction; remove both arms, sleeves and side cape wings; reconstruct the central turtleneck and two vertical shawl drapes through the seated hips. Front-facing, full head and hip, genuine alpha, no table, chair or hands. The earlier narrow torso was rejected; the current plates retain natural shoulder cloth overlaps with no arms.
- Skin: seamless diffuse tile, muted warm tan `#b98b6d`, fine elderly skin creases and sparse small age freckles; detailed restrained pixel clusters; neutral illumination, no baked shadows, limbs, nails, hair, borders or text.
- Cloth: seamless diffuse tile, midnight indigo `#282237`, woven wool and sparse antique-gold `#8c7050` star stitches; fine pixel texture, even illumination; no baked folds, hems, borders, objects or text.

## UV use and ownership

The hands use their original GLB `TEXCOORD_0` UV islands. Procedural forearms and sleeves use cylindrical LatheGeometry UVs; elbow surfaces use spherical UVs. Texture clones belong to the Scene and are disposed alongside their leases. Skin and cloth albedo images are shared between left/right rigs, with separate skin/cloth materials, sRGB sampling, nearest magnification and mipmapped minification. Patterns deform with skin weights and remain attached to the surface. These are tiling material maps, not anatomically painted knuckle/nail atlases or a claim of a bespoke elderly hand sculpt.

## Runtime relief and lighting

`tarot-materials.ts` builds periodic 128 × 128 tangent-space normal maps from finite differences of weave/pore/grain height functions and separate roughness maps. These are linear data textures, not image-generated normal guesses or shadows painted into diffuse maps. MeshStandardMaterial combines them with the albedos. Cloth and skin are UV-mapped on rigged geometry. The desk and floor use separate reference-derived albedos, `table-reference-albedo.png` and `floor-reference-albedo.png`, generated on 2026-10-11 from the user’s `table.webp` and `room.webp`; the complete mat uses its full image and alpha border. Directional shadow-map and all material/target resources are disposed with Scene ownership. Only meshes explicitly marked for limb pixelation are composited at reduced resolution; source art remains full resolution.

## Checksums

- `cloth-albedo.png`: SHA-256 `75eefc03766b68b5cf62e9f8c8b31e306c3a47fe4bd6502e5727a15f84fedd8c`; 3540273 bytes; (1254, 1254) px.
- `left.glb`: SHA-256 `bc67783144944ea1cda54d9247885825ea5fb9d4651469fe7d00be517a5c2b87`; 94572 bytes.
- `oracle-front-v4.png`: SHA-256 `811a32f1561da63c67a40f5e43c2d48d66360c5eae99ce25a0e479b9ae273842`; 1252745 bytes; (1122, 1402) px.
- `oracle-oblique-v4.png`: SHA-256 `cb629dc3cee8627e10f6dc8923b13dd530014aa282d8d1f7c2d2fdf0fced59eb`; 1460908 bytes; (1122, 1402) px.
- `reading-mat.png`: SHA-256 `24d56c66afec6bcfb368fa12e76ba57092badc62e1b230d74a4847e3f8cd9ca7`; 3506324 bytes; (1659, 948) px.
- `right.glb`: SHA-256 `291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96`; 94004 bytes.
- `skin-albedo.png`: SHA-256 `f8b61a50c89a0c820928fe12a24586c220ee49e8dea0eb0b662217eb4c6425ca`; 1944249 bytes; (1254, 1254) px.
- `walnut-albedo.png`: SHA-256 `8908dcf1080336599104d65439abce367864556d813285899520cb3acfb45b38`; 2320357 bytes; (1254, 1254) px.

## Reference-matched wood revision

The earlier generic walnut is superseded by separate original-art references. Original artwork remains unchanged. Both new images were generated with the built-in image_gen tool; exact prompts are in `docs/assets/tarot-material-prompts.md`. They are albedo images, not normal maps.

- `floor-reference-albedo.png`: SHA-256 `8eab83cfdd2e9d33aa962f319d5042f4570683c3a461fe78755c54d0f787aefc`; 1981698 bytes.

- `table-reference-albedo.png`: SHA-256 `9ae9dcdd7c536809a583b8aa23b2602ed17c4b6a19e99eeb360a4afa1145648a`; 2330097 bytes.
