# Globe and lighting resource qualification

The software and Apple M4 hardware runs both have bounded WebGL allocations over seven navigation cycles. The hardware follow-up below measures this desktop configuration; physical mobile devices and thermal endurance remain unqualified. Software raw results: [performance.json](performance.json); hardware raw results: [performance-hardware.json](performance-hardware.json). Reproduction: `node scripts/measure-globe-lighting.mjs` against the local Storybook server (default port 6007, override `STORYBOOK_URL`).

## Method and environment

Measured 2026-10-11 in actual headless Chromium 141, WebGL 2, 1280×720, DPR 1. The reported renderer is ANGLE Vulkan **SwiftShader**, a software renderer. The script imports the production `SceneRuntime` and landing/astrology/tarot factories through Vite into a static same-origin document. It creates one persistent production renderer and uses real production textures, scene resources and geometry. It does not reproduce scenes in a benchmark-only implementation. The static document avoids Storybook HMR interrupting measurements.

Camera data uses normalized viewport dimensions. Astrology snapshots are settled overview and Singapore country frames; cycles also select Fiji. Tarot uses the production selecting phase and `selection` review composition. Fixed review frames make repeated geometry counts comparable. Shader compilation, texture decoding, browser cache state and other host work can affect timings.

The software and hardware performance artifacts measure the **authored full rig with lamp shadows enabled**, independently of the later capability fallback. The reusable runner explicitly enables the lamp shadow after navigation and before its on/off comparison, so those labels and repeated-cycle fixtures remain comparable. Production default-policy evidence is recorded separately below.

`renderer.info.autoReset = false`, followed by one explicit reset per complete scene render, counts all passes, including tarot's selective pixel compositing and the shadow pass. WebGL create/delete wrappers independently count buffers, textures, framebuffers, renderbuffers, programs and shaders. This catches instance-buffer leaks that renderer geometry counters alone miss.

## Final render cost

| Production view | Draw calls, lamp shadows on/off | Submitted triangles, shadows on | Renderer geometries / textures |
| --- | ---: | ---: | ---: |
| Room | 61 / 53 | 51,908 | 51 / 25 |
| Globe overview | 37 / 29 | 166,288 | 35 / 24 |
| Singapore country | 29 / 21 | 160,326 | 28 / 24 |
| Tarot selection | 250 / 223 | 207,052 | 57 / 51 |

The lamp's 512×512 shadow adds 8 draw calls and 9,472 submitted triangles in room/globe views, and 27 calls / 19,086 triangles across tarot's multiple passes. Disabling it releases **two renderer-counted textures**. A 512² RGBA8 color attachment plus a 32-bit depth attachment has a nominal 2,097,152-byte texel payload; this is an attachment calculation, **not measured driver memory**, and excludes allocation padding or implementation overhead. The fill and candle do not cast shadows.

An initial diagnostic run used country-resolution relief in the room and tarot: 179,492 and 713,548 submitted triangles respectively. Selecting a fixed lower room tier reduces these to 51,908 and 207,052, approximately **71% fewer triangles**, while country exploration retains detailed terrain. No streaming or adaptive tessellation was introduced.

## Source baseline comparison

The optional comparison temporarily restored **only** `packages/scenes/src/tarot.ts` from commit `2482c84` as `measurement-baseline.ts`, while retaining the current shared runtime, composition and other dependencies. The temporary file was deleted after capture. This is an approximate source baseline, **not a clean historical build**; current common composition includes depth-write changes and runtime shadow configuration.

With the same selecting/review fixture, the original tarot source recorded **144 calls, 43,012 triangles, 38 renderer geometries and 42 renderer textures**. The integrated scene records 250 / 207,052 / 57 / 51, adding **106 calls, 164,040 triangles, 19 geometries and 9 textures** for the new props and their interactions with the existing multipass renderer. The baseline retains its original directional shadow; the script's named-lamp shadow toggle does not disable that original light. Its identical on/off records must not be interpreted as a shadow-free comparison.

To reproduce this optional comparison, restore that one historical source file under the temporary name before running the script and remove it afterward. Normal script runs omit the historical comparison when the file is absent.

## Repeated navigation and cleanup

Each of seven cycles traversed astrology overview → Fiji country → tarot selecting → landing. At every returned room frame the counts were identical:

- 51 renderer geometries and 25 renderer textures.
- 204 live GL buffers, 29 GL textures, 4 framebuffers and 22 programs.
- 0 live shader objects and 0 renderbuffers.

The initial diagnostic run exposed **two additional live buffers per cycle**. The globe's graduated-ring `InstancedMesh` needed explicit object disposal in addition to geometry disposal. After that fix the final seven-cycle sequence remains exactly **204, 204, 204, 204, 204, 204, 204 buffers**.

Final runtime disposal deleted all **4,889 created buffers**, released every texture lease (**0 remaining**), and confirmed the WebGL context was lost. Raw wrapper counters still list 21 textures, 3 framebuffers and 9 programs without individual delete calls at context loss. These counts include renderer internals and are not surviving GPU allocations after context destruction; they were bounded throughout navigation. Driver allocation bytes and shader-program byte sizes are not exposed by this measurement.

There were **zero page errors and zero scene-preparation failures** in the final pass. This verifies the measured navigation sequence, not every possible abandoned preparation or device behavior.

## Timing limits

60 production update/render submissions per view yielded median / p95 wall-clock durations: room **0.6 / 1.6 ms**, overview **0.4 / 1.1 ms**, Singapore **0.2 / 0.5 ms**, tarot **316.0 / 782.6 ms**. The approximate old tarot source yielded **2.0 / 466.4 ms**. The 30-frame returned-room animation-frame sample had median **49.9 ms** and p95 **116.6 ms**.

These are software-browser diagnostic observations, **not GPU execution times or hardware FPS guarantees**. Queued GPU commands can make submissions appear very cheap; software-driver backpressure can make them block for hundreds of milliseconds. `EXT_disjoint_timer_query_webgl2` was unavailable. Tarot's software-renderer cost remains substantial. The Apple M4 follow-up below supplies hardware GPU timings. Thermal behavior and physical mobile performance remain unqualified.

Navigation-to-second-render durations ranged from 3.93 to 15.71 seconds for production cases on this software run; each includes a deliberate 70 ms stabilization wait, so they are not pure initialization timings. The approximate historical tarot case took 25.44 seconds. These cache/compilation-sensitive single samples are retained in JSON, not treated as a shipping latency budget.

## Download footprint

All nine globe files total **6,279,100 bytes**, or **4,884,979 bytes** when each is gzip-compressed at level 9. This is reproducible local compression, not a captured CDN Content-Encoding policy. Already-compressed PNGs sometimes grow slightly under gzip.

The room tier plus shared material assets is **1,058,875 bytes raw / 1,015,623 gzip**; it does not request country polygons. The country tier plus shared assets is **5,323,448 raw / 3,972,650 gzip**. The complete nine-file total includes both tiers; shared resources should not be added twice. Individual file sizes are in JSON.

The lamp mesh and its four procedural textures require no bitmap/model download. Its texture source texels total 262,144 bytes before mipmaps, as documented in [lamp provenance](../../assets/lamp.md). The candle reuses existing artwork. These globe totals exclude pre-existing room/card/hand artwork, JavaScript bundles, GeoNames country-city shards and WASM; they are the new globe asset footprint, not the entire application download.


## Apple M4 hardware follow-up

Both a fresh headed Chromium process and a fresh headless process launched with `--use-angle=metal` reported **ANGLE Metal Renderer: Apple M4**, rather than SwiftShader. No user browser profile was opened. The full production measurement then ran in headless Chromium 141 at 1280×720, DPR 1, with Metal and `EXT_disjoint_timer_query_webgl2` enabled. The software JSON was preserved separately.

| Production view | GPU median / p95 ms | CPU submission median / p95 ms |
| --- | ---: | ---: |
| Room | 0.382 / 2.157 | 0.3 / 1.4 |
| Globe overview | 0.533 / 1.150 | 0.2 / 0.3 |
| Singapore country | 0.581 / 2.860 | 0.1 / 0.2 |
| Tarot selection | 1.543 / 2.293 | 1.6 / 3.4 |

Each GPU result has **12 valid, non-disjoint timer-query samples** around the complete production update/render submission, including its shadow/compositing passes. CPU distributions have 60 samples. With only 12 GPU samples, the recorded nearest-rank p95 is also the observed maximum; these are short measurements, not a long-run percentile guarantee. All four GPU p95 values were below 3 ms on this configuration. The 30-frame room requestAnimationFrame sample had **16.7 ms median and p95**. Browser presentation timing is separate from GPU execution; these data do not establish end-to-end interaction latency or thermal endurance.

The final room counts matched on all seven hardware cycles: **204 GL buffers, 29 GL textures, 4 framebuffers, 20 programs, 51 renderer geometries and 25 renderer textures**. Program count is lower than the software run because the hardware run did not load the optional historical source baseline. All **4,732 buffers** were individually deleted on final disposal, texture leases returned to **0**, context loss was confirmed, and there were **0 page/preparation errors**. Draw/triangle and shadow costs matched the software run.

Hardware navigation-to-second-render samples were room 1,823.7 ms, overview 317.9 ms, Singapore 220.2 ms and tarot 3,000.0 ms, each including the intentional 70 ms stabilization wait. Cold shaders/artwork still affect preparation even when warmed rendering is inexpensive. No historical hardware baseline was measured.

Reproduce without overwriting the software artifact:

```sh
CHROMIUM_ARGS='["--use-angle=metal"]' MEASURE_GPU_TIMERS=1 \
MEASUREMENT_OUTPUT=docs/validation/globe-lighting/performance-hardware.json \
node scripts/measure-globe-lighting.mjs
```

`CHROMIUM_HEADED=1` optionally selects a fresh headed process. Defaults remain the original headless software run and `performance.json`. The available desktop hardware has now been measured; **physical mobile hardware, broader GPU coverage and sustained thermal/memory-byte budgets remain open**.


## Measured capability fallback and desktop fixture budget

The runtime now disables lamp shadows for identified software renderers (SwiftShader, llvmpipe, softpipe or Software Rasterizer), or when the maximum texture dimension is below 512. The real lamp light, emissive shade, fabric fill and candle remain active. The existing 512×512 lamp shadow remains enabled on supported desktop hardware. This policy changes shadow cost only; it does not label software output as hardware qualification.

An actual fresh production-runtime probe, with **no manual shadow override**, exercised landing, astrology overview and tarot on both SwiftShader and Apple M4 Metal. Evidence: [quality-policy.json](quality-policy.json).

| Production route | SwiftShader default | Apple M4 default | Draw calls saved by fallback |
| --- | --- | --- | ---: |
| Landing | No shadow target; 53 calls / 23 textures | 512² shadow; 61 calls / 25 textures | 8 |
| Astrology overview | No shadow target; 29 calls / 21 textures | 512² shadow; 37 calls / 24 textures | 8 |
| Tarot selection | No shadow target; 223 calls / 49 textures | 512² shadow; 250 calls / 51 textures | 27 |

SwiftShader reported max texture dimension 8192 but correctly selected the software fallback; Metal reported 16384 and retained shadows. Every lamp kept intensity 24. Both three-route probes completed with zero preparation errors, zero remaining leases and confirmed context loss on disposal. The sub-512 dimension branch is a policy-unit-test case, not a separately measured physical device.

The provisional **Apple M4 / Metal / Chromium 141 / 1280×720 DPR 1 desktop fixture GPU budget is p95 ≤ 4 ms** for each of the four full-rig review views. All measured GPU p95 values (1.150–2.860 ms) fit that budget. This is a narrowly scoped regression budget grounded in the available 12 valid timer-query samples per view, not a universal device or thermal budget. Physical mobile, broader GPU coverage, sustained workloads and driver memory-byte budgets remain unqualified.
