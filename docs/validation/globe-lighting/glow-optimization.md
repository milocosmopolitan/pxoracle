# Tarot glow optimization qualification

The production separable HalfFloat glow preserves the measured card glow to **at most 1/255 channel difference**, while improving paired GPU p95 in all three fixed fixtures. The final full-scene tarot p95 is **6.983 ms**, still above the provisional 4 ms component target. This is not a sustained 30 fps qualification.

## Actual production A/B

[Raw paired measurements and image differences](blur-ab.json). The current tarot factory was compared with an identical source copy whose only change imports the old pixel presentation from commit `4e8e6c2`. That old module is byte-identical to the supplied pre-optimization snapshot, SHA-256 `f70b56a9b57c99a28d1c8a8fd44a8b795bd0e79c3e339092d7680cd40a7046a5`. Temporary source modules were removed afterward.

One actual Apple M4 Metal Chromium renderer, 1280×720 DPR 1, rendered both production instances. Each fixture used 30 paired warm-up frames followed by 60 alternating whole-frame GPU query samples per version. All samples were valid. Display-only synthetic cards use existing production artwork; no engine calculations are mocked or used here. Fixed selection, reading and detail frames avoid animation drift.

| Fixture | GPU p95, original → optimized | Reduction |
| --- | ---: | ---: |
| selection | 8.820 → 7.414 ms | 15.9% |
| reading | 8.573 → 7.171 ms | 16.4% |
| detail | 7.569 → 6.415 ms | 15.2% |

These are within-run paired comparisons. Separate qualification runs vary with browser/driver/host conditions and should not be substituted for the pairing. The 4 ms target remains unchanged.

## Visual review

All six actual rendered screenshots were inspected. Card art, framing, typography, hand positions and authored material colors remain unchanged. Reading/detail glow differences are at roundoff level. Selection's larger difference is the intentional removal of the flame Sprite from the selection mask and unrequested glow pass, eliminating its duplicate halo while preserving its original flame layer and real light.

- Selection: [original](blur-selection-before.png), [optimized](blur-selection-after.png). Mean absolute channel difference 0.079093; max 187 is confined to the flame. Outside ROI x=1170–1235, y=80–165, max difference is **1/255**. All 1,981 pixels exceeding three channel units lie within x=1181–1222, y=91–151.
- Reading: [original](blur-reading-before.png), [optimized](blur-reading-after.png). Mean 0.000386, max **1/255**, 1,054 changed pixels and none above three channel units.
- Detail: [original](blur-detail-before.png), [optimized](blur-detail-after.png). Mean 0.001290, max **1/255**, 3,527 changed pixels and none above three channel units.

The initial RGBA8 intermediate candidate was rejected: reading/detail had max 13/255 differences from quantizing the two intermediate convolutions before glow amplification and color conversion. Its [raw evidence](blur-ab-rgba8.json) and three `blur-*-rgba8.png` images remain available. HalfFloat intermediates resolve that precision loss without changing the seven-tap kernel, radius or glow strength.

## Capability fallback

The actual Metal backend reports `EXT_color_buffer_float` support. A diagnostic-only override of `renderer.extensions.has` forced the absent-capability branch before the first production render; no production source was changed. [Fallback evidence](blur-fallback-ab.json).

The fallback uses the original 49-tap shader. Reading and detail screenshots are **bit-identical** to the old pipeline. Selection is also bit-identical outside the same flame ROI; the intended flame fix remains. All three fixtures produced 60 valid GPU samples per variant. Both A/B browsers finished with zero page errors, zero texture leases and context loss. This forced branch check does not claim physical unsupported-device coverage.

## Cost and cleanup

The new path uses two depthless 640×360 RGBA16F targets at this viewport: **3,686,400 bytes, or 3.516 MiB**, nominal color payload. This excludes padding/driver overhead and is not measured driver allocation. It adds two GPU textures and two framebuffers while tarot is active; the shared full-screen geometry adds no extra geometry buffers. In selection, two blur draws replace two unwanted Sprite draws, leaving total calls at 222; reading/detail each add two draws and four triangles.

The final full-runtime seven-cycle resource run returns to 218 live GL buffers each time and deletes all 4,826 created buffers on disposal. Returned-room targets remain bounded; no extra retained allocations from the blur targets appear. Full counts and software/default-policy results are in [performance.md](performance.md).

## Reproduction

`node scripts/measure-tarot-blur-ab.mjs` creates and removes its temporary old-source fixtures, captures six images, records paired GPU samples and computes pixel differences. To force the capability fallback: `FORCE_GLOW_FALLBACK=1 BLUR_OUTPUT_TAG=blur-fallback node scripts/measure-tarot-blur-ab.mjs`. Both use a fresh Metal Chromium process and never open user browser data.

The pre-optimization [12-sample miss](performance-hardware-mesh-12sample.json), [60-sample miss](performance-hardware-pre-blur.json), and [pass diagnosis](performance-diagnostic.json) are preserved. No result was rerun until it passed, and no quality/budget threshold was widened.
