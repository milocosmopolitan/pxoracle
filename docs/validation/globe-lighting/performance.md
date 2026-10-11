# Globe and lighting resource qualification

Final measurements include the original 3D wax/holder candle, bounded wax-light response and front-right globe placement. Both SwiftShader and Apple M4 show bounded resources over seven navigation cycles. **The provisional 4 ms GPU p95 budget is not met by tarot in the final 60-sample Metal run, after a measured glow optimization.** Physical mobile, broader hardware and thermal endurance remain unqualified.

Raw evidence: [software](performance.json), [Metal, 60 samples](performance-hardware.json), [preserved initial Metal, 12 samples](performance-hardware-mesh-12sample.json), [production default shadow policy](quality-policy.json), [pre-optimization 60-sample miss](performance-hardware-pre-blur.json), and [strict glow A/B qualification](glow-optimization.md).

## Method

Actual headless Chromium 141, WebGL 2, 1280×720, DPR 1, measured 2026-10-11. Software reports ANGLE Vulkan SwiftShader; hardware reports ANGLE Metal Apple M4. The runner imports production SceneRuntime and landing/astrology/tarot factories through local Storybook Vite into a static same-origin document, creates one persistent production renderer and uses real assets. No substitute scene or user browser profile is used. Other task browser captures/tests were stopped for timed runs; host OS and other applications are not controlled.

Fixed settled frames: room, globe overview, Singapore country, tarot selecting with selection review composition. Complete-frame renderer.info counters use autoReset=false with one reset per scene render. Independent WebGL create/delete wrappers count buffers, textures, framebuffers, renderbuffers, programs and shaders. The optimized tarot path uses HalfFloat separable glow when EXT_color_buffer_float is present, with the original 49-tap shader fallback otherwise. The runner explicitly enables authored lamp shadows before full-rig comparisons; production capability defaults are measured separately without overrides.

CPU distributions contain 60 production update/render wall-clock submissions. GPU timing uses EXT_disjoint_timer_query_webgl2 around all production passes, 60 bounded attempts per view, excluding unavailable/disjoint results. All four final Metal views returned 60 valid samples; raw accepted samples are retained. The nearest-rank p95 is sorted sample ceil(0.95×N), not an extrapolated percentile. Queries are polled for at most 120 animation frames each. Navigation timing includes preparation, first rendering and an intentional 70 ms stabilization wait. No birth records or search terms enter the fixture.

## Final render cost

| Production view | Calls, shadows on/off | Triangles, shadows on | Renderer geometries / textures |
| --- | ---: | ---: | ---: |
| Room | 63 / 55 | 67,018 | 55 / 27 |
| Globe overview | 40 / 32 | 181,400 | 40 / 26 |
| Singapore country | 30 / 22 | 168,774 | 30 / 25 |
| Tarot selection | 222 / 195 | 175,140 | 52 / 53 |

Draw/triangle costs match across software and hardware. A 512² lamp shadow adds 8 calls / 9,472 triangles in room/globe frames and 27 calls / 19,086 triangles across tarot passes. Disabling it releases two renderer-counted textures. A 512² RGBA8 color attachment plus 32-bit depth attachment has nominal 2,097,152-byte texel payload, **not measured driver memory**. No candle/fill shadow is added.

Tarot renders the world to low-resolution, full-resolution and mask targets, then composites. Active glow now adds its world pass plus horizontal/vertical HalfFloat blur passes, seven passes total in the measured selection fixture. This explains its greater draw cost. Final tarot has fewer draws/triangles than the prior placement (250 calls / 207,052 triangles); slower timings alone do not establish a geometry regression. Per-pass GPU causality and host thermal/power state were not isolated.

## Seven-cycle cleanup

Each cycle traverses astrology overview → Fiji country → tarot selecting → landing. Both final runs return exactly **218 GL buffers, 31 GL textures, 4 framebuffers, 18 programs, 55 renderer geometries and 27 renderer textures** on every cycle. Live shader objects and renderbuffers remain zero. New candle mesh/texture allocations are included.

All **4,826 created GL buffers** are individually deleted on final disposal in both runs, leases return to **0**, and context loss is confirmed. Wrapper counts retain 21 textures, 3 framebuffers and 7 programs without individual delete calls at context destruction; these bounded renderer internals are not surviving allocations after WebGL context loss. Driver allocation bytes and shader-program byte sizes are unavailable. There are zero page errors and zero scene-preparation failures in both complete runs.

An earlier diagnostic found two leaking graduated-ring instance buffers per navigation. Explicit InstancedMesh disposal fixed this; final counts remain 218 for all seven cycles. This sequence does not replace separate failure/abandonment tests.

## Hardware timing and budget

| View | GPU median / p95 / max ms | CPU submission median / p95 ms |
| --- | ---: | ---: |
| Room | 0.993 / 1.884 / 3.597 | 0.2 / 0.7 |
| Globe overview | 1.806 / 3.722 / 5.840 | 0.2 / 0.7 |
| Singapore country | 2.053 / 3.930 / 4.678 | 0.1 / 0.2 |
| Tarot selection | 4.215 / 6.983 / 7.501 | 1.3 / 2.2 |

The prior provisional **Apple M4 / Metal / Chromium 141 / 1280×720 DPR 1 budget remains GPU p95 ≤ 4 ms per review view**. Room, overview and Singapore pass; tarot **6.983 ms fails**. No threshold was widened. The initial final-mesh 12-sample run recorded Singapore 4.587 ms, already above budget; that complete artifact is preserved. Because p95 equals max at N=12, all four views were then measured once with 60 attempts for better precision, rather than selecting a passing retry. The pre-optimization 60-sample run then recorded tarot p95 9.106 ms. Both pre-optimization misses are preserved; the final optimized result remains a qualification gap. The application caps normal rendering at 30 fps (33.3 ms/frame), so a missed 4 ms component target does not establish a failed 30 fps experience. Sustained/end-to-end qualification was not measured.

The final room animation-frame sample has median **16.7 ms** / p95 **16.8 ms** across 30 intervals. This is browser scheduling, not end-to-end interaction latency or a thermal guarantee. Hardware preparation samples, including the 70 ms wait: Room 486.3 ms, Globe overview 336.5 ms, Singapore country 256.8 ms, Tarot selection 589.8 ms.

## Measured glow optimization

The pre-optimization [paired pass diagnostic](performance-diagnostic.json) found full-resolution glow compositing expensive: median 4.432 ms, with full-rig summed-stage p95 14.916 ms versus 14.828 ms without lamp shadows. Its five-pass query instrumentation perturbs totals, so those numbers do not replace whole-frame qualification. The diagnostic motivated replacing the original 49-tap full-resolution glow convolution with two seven-tap half-resolution convolutions and one final glow sample.

The final path uses two depthless RGBA16F 640×360 targets, nominal **3,686,400 bytes / 3.516 MiB** at this fixture. Their two texture/framebuffer allocations are released on scene disposal; returned-room resource counts remain unchanged. HalfFloat avoids the visible precision loss measured in the rejected RGBA8 candidate. If EXT_color_buffer_float is absent, the exact original 49-tap shader remains active. Both measured real backends support the optimized path; the absent-capability branch was exercised by a diagnostic override.

[Strict actual-production A/B](glow-optimization.md) preserves reading/detail within **1/255** channel difference. The fallback is bit-identical for those frames. Selection differs materially only at the candle, where excluding the flame Sprite from the mask/unrequested glow pass removes a duplicate halo. Paired GPU p95 improved selection 8.820→7.414 ms, reading 8.573→7.171 ms, and detail 7.569→6.416 ms. The separate final full-frame qualification records tarot 6.983 ms versus the preserved pre-optimization 9.106 ms, still above the unchanged 4 ms provisional component budget. A normal 30 fps frame interval is 33.3 ms; these isolated GPU samples do not establish sustained application FPS.

## Software timing limits

Median / p95 CPU submission durations: Room **0.4 / 1.8 ms**; Globe overview **0.2 / 0.4 ms**; Singapore country **0.4 / 1.1 ms**; Tarot selection **102.9 / 702.8 ms**. The room requestAnimationFrame sample is **50.0 / 83.3 ms**. EXT_disjoint_timer_query_webgl2 is unavailable on this backend. These values reflect CPU submission and software-driver backpressure, **not hardware GPU execution or physical-device FPS**. Software tarot cost remains substantial. Preparation samples range 2.35–13.11 seconds, including the deliberate wait; cache/shader-sensitive single samples are not shipping latency budgets.

## Production shadow fallback

Runtime disables lamp shadows for SwiftShader, llvmpipe, softpipe or Software Rasterizer, or max texture dimension below 512. Actual warm light, shade emission, fill and candle remain active. No-override probes confirm software disables its shadow target and Metal retains 512² shadows, with lamp intensity 24 on both.

| Route | Software calls / textures | Metal calls / textures | Calls saved |
| --- | ---: | ---: | ---: |
| Landing | 55 / 25 | 63 / 27 | 8 |
| Astrology overview | 32 / 23 | 40 / 26 | 8 |
| Tarot selection | 195 / 51 | 222 / 53 | 27 |

Software reports max texture size 8192; Metal reports 16384. Both default-policy probes have zero page/preparation errors, zero remaining leases and confirmed context loss. A fresh default-off scene can retain fewer textures than an on-then-off scene because caster-only resources were never uploaded. The sub-512 branch is unit-tested, not physically measured.

A subsequent runtime presentation fix submits one identical follow-up frame after an on-demand invalidation, then returns to idle; fixed camera-review frames no longer request continuous rendering. Individual scene geometry, materials, lights and per-frame draw cost are unchanged. The short region/chooser probe below was repeated against that final export: city selection still triggers zero additional draws with identical pixels/resources. The 60-sample GPU and seven-cycle artifacts predate this scheduling-only fix and are not presented as a fresh whole-runtime rerun; resource-cycle verification of that runtime revision is tracked separately in the final CI results.

## Region and HTML chooser baseline

[Final supplemental raw measurement](region-chooser-performance.json), reproduced with `node scripts/measure-globe-chooser.mjs`, closes the explicit region/HTML-chooser measurement scope. It uses the final static production app at localhost:4173 and the production astrology factory through Storybook, actual Metal Chromium, 1280×720 DPR 1, reduced motion. Inputs are public synthetic Singapore/Singapore; no date or private birth record is entered.

The actual app's settled Asia frame submitted **38 calls / 179,860 triangles**. Its Singapore HTML chooser submitted **27 calls / 158,404 triangles** before and after city selection. Selection triggered **zero additional WebGL draws** (cumulative325→325), preserved the same canvas object and camera revision3, and produced **pixel-identical scene captures**. Live GL resources remained exactly **227 buffers,33 textures,4 framebuffers,13 programs**. No new geographic request occurred after city selection.

Before country selection, the observed six globe asset paths totaled **5,323,448 raw / 3,972,650 independent gzip9 bytes**; no city shard was requested. Choosing Singapore loaded only `/content/atlas/SG.geonames-world.2026-10-11.json`, **10,870 raw / 4,283 gzip9 bytes**. The local server served that shard without Content-Encoding; gzip is a declared compression equivalent, not a claimed network transfer. Region asset sizes come from the corresponding runtime files for observed request paths. Typing/selecting a city added no terrain or geographic-detail payload.

DOM element count fell from310 with results to162 after selection. Fill-to-visible-results took13.66ms and Enter-to-confirmation3.47ms, measured from the Playwright driver and including automation overhead. These single samples are not pure event-handler timings or a latency budget.

The separate sequential production-factory fixture measured overview→Asia→Singapore with a full normalized camera viewport: Asia **33 calls /170,260 triangles /41 renderer geometries /24 renderer textures /159 live GL buffers**. Singapore retained41 geometries because resources uploaded in earlier views remain owned by the same assembly; it replaced and disposed the region highlight buffer. All160 created buffers were deleted on final teardown, texture leases returned to0 and context loss was confirmed. App and isolated-factory counts differ because the app supplies its real layout/view data and upload history; neither set substitutes for the other. Both runs had zero page/preparation errors.

## Downloads and historical comparisons

Nine globe files total **6,279,100 raw bytes / 4,884,979 gzip bytes**. Room tier plus shared material assets: **1,058,875 / 1,015,623**; country tier plus shared assets: **5,323,448 / 3,972,650**. Room does not request country polygons. Gzip is independent local level-9 compression, not CDN transfer measurement; shared assets must not be counted twice.

Lamp geometry and four procedural 128² textures require no bitmap/model download, with 262,144 source texel bytes before mipmaps. Candle body/holder are original procedural Mesh, 15,118 triangles, six owned geometries, five materials and two 128² local maps (131,072 source texel bytes). Its flame retains the existing artwork lease. Globe totals exclude existing room/card/hand/flame artwork, JS, GeoNames country shards and WASM; they are not total app download size.

The historical approximate tarot baseline from source commit 2482c84 recorded 144 calls, 43,012 triangles, 38 renderer geometries and 42 textures while using the then-current common runtime/composition. Final integrated tarot is 222 / 175,140 / 52 / 53, a delta of 78 calls, 132,128 triangles, 14 geometries and 11 textures. This is **not a clean historical build**; [baseline raw evidence](https://github.com/milocosmopolitan/pxoracle/blob/4e8e6c2/docs/validation/globe-lighting/performance.json) remains in repository history before this final-fixture refresh. Its original directional shadow was not toggled by the named-lamp switch. Initial fixed room-LOD optimization reduced the earlier pre-3D-candle scene's triangles about 71%; that historical percentage should not be applied to the new candle geometry.

## Reproduction

```sh
node scripts/measure-globe-lighting.mjs
CHROMIUM_ARGS='["--use-angle=metal"]' MEASURE_GPU_TIMERS=1 MEASUREMENT_OUTPUT=docs/validation/globe-lighting/performance-hardware.json node scripts/measure-globe-lighting.mjs
```

Default Storybook URL is localhost:6007, overridable by STORYBOOK_URL. CHROMIUM_HEADED=1 selects a fresh headed process. Physical mobile, broader GPU coverage, sustained workloads and driver memory-byte budgets remain open, alongside the measured tarot 4 ms budget miss.
