# Natal scene and controller contract

`AstrologyView` contains phase (`entry`/`chart`), revision, ten `{id, longitude}`
display bodies, supported Whole Sign boundaries and aspect pairs, a body/pair/null
selection, normalized usable viewport, and intent/readiness callbacks. No birth
date, location, notes, rule pack or full engine session enters Three.js. DOM and
raycasting dispatch the same selection into the root Zustand provider.

The room, table and crystal art remain at their original world coordinates. The
map anchor is (-3.4, 0.13, 0.4). A 32° perspective camera changes position and target
in that same scene: entry radius 4.2, overview 1.25, body 0.84, relationship 1.02.
The camera distance accounts for the smaller usable viewport dimension; an off-axis
projection centers the target outside the DOM panel. Entry/overview moves take 1.6s,
detail moves 0.7s, using smoothstep. Reduced motion and a restored chart snap to the
final framing. The Canvas stays full size throughout.

Longitude is a symbolic angle map, not an orbit. Collision layout uses a deterministic
largest-gap cut, ordered separation (21° desktop / 26° narrow viewport), wraparound
constraints and leader lines to true longitudes. Transparent body hit meshes have a
minimum 44 CSS-pixel diameter. Overlapping hit targets choose the nearest center.
Aspect lines are raycast separately. Picking is blocked while the camera moves;
the settled view has no idle camera drift. Runtime drag rejection uses the existing
8px movement threshold. Empty map/background, Escape and Whole chart clear focus.

The controller generation invalidates earlier commands and aborts prose requests.
Route abandonment evicts the owned Worker, while facts/plan survive in Zustand.
Returning resumes a pending interpretation using the same facts and saved-plan
expectation. A failed load cannot redraw/recalculate a chart. Unsupported saved
interpretations and inconsistent supported plans require explicitly labeled generation
of a new interpretation; the original localStorage value is untouched until Save.

The scene owns its camera paths, meshes, hit targets, geometries, materials and label
textures. Map replacement disposes the previous dynamic resources; scene disposal
also releases static resources and the room's shared-art leases. Preparation failure
and stale completion follow the existing runtime ownership contract. No new character,
hand or table artwork was created for this epic.

Stories live under `PXOracle/Natal reading`: camera sequence, fixed overview/body/
relationship views, mobile, reduced motion, unknown-time and crowded markers, plus
input/report/legacy/error states. Ordinary stories use labeled synthetic fixtures and
mock transport, not real WASM. Actual app browser tests exercise real Worker/WASM.
