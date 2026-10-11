# ADR 009: Country-framed globe and prop-owned study lighting

Status: implemented with measured Apple M4 desktop and software fallback qualification; physical mobile remains unqualified. Baseline main: `2482c84ef91fcc9643247493629ebb01f6c68ada`.

## Ownership and privacy

The root Zustand provider owns region, country, candidate city and camera revision.
The application owns GeoNames shards, search, explicit confirmation, date/zone entry
and calculation. `GlobeView` includes only phase, region/country identifiers, usable
viewport, revision and intent callbacks. City points and full birth records never
enter the scene. Rust/WASM and saved chart formats remain unchanged.

Phases are room, overview, region, country and crystal. City/manual input is form
state within the last country framing. Selecting a city does not increment the
camera revision. A country/region change invalidates the candidate and coordinate
fields; a late city completion must match both country and revision. Browsing is
not confirmation. Cancel changes the view only and does not change natal provenance
or a saved chart. Direct entry works from room framing; route return retains root
selection. Back one view unwinds country → region → overview → room; browser
history remains route history and carries no private data in its URL.

Geography uses degrees, north/east positive, longitude [-180,180). Sphere-local
coordinates are x=cos(latitude)sin(longitude), y=sin(latitude),
z=cos(latitude)cos(longitude). Greenwich faces +Z. A tilted mount is separate from
the sphere's geographic transform. Dataset and mesh use the same conversion; UV
u=(longitude+180)/360, v=(latitude+90)/180. Selection boundaries are data, decorative
printing is not an authority for timezone or political status.

Europe, Asia, Middle East, Africa, North America, South America and Oceania are
browsing groups. Multiple memberships are explicit in generated metadata; All
countries includes all 244 existing atlas entries. Missing geometry never removes
an entry or invents a boundary. Islands/dateline extents use shortest wrapped bounds.
Country magnification is bounded, including tiny countries. No city zoom, pin,
surface-coordinate entry, urban terrain, city-label streaming or inferred timezone.

## Props, materials and coordinates

Lamp and candle factories each return a local +Y-up group with base y=0, named
bulb/wick anchors, attached lights, deterministic update and idempotent disposal.
Scene placement is centralized in `study-props.ts`. Tarot's table has a -90° X
rotation; props use world-space groups rather than inheriting that rotated parent.
The lamp shade bends +X, matching the old image's `flipX: true` usage.

The lamp SpotLight is the main warm shadow source. Its target belongs to the prop
group, never the camera. Candle PointLight is shadowless and shares a continuous
seeded signal with flame deformation. Reduced motion uses a static signal. Cool
hemisphere/window/rim illumination remains; the old warm directional, deskGlow and
shoulderGlow are removed to avoid duplicate warm sources. Exposure remains fixed.
Painted room/portrait and card face colors retain their unlit material policy;
wood, hands, lamp, globe and tabletop receive real light. Emissive shade is visible
glow, not a substitute for illumination.

## Resource lifecycle

The persistent runtime owns the renderer, shadow enablement and frame scheduling.
Factories own local geometry, materials and shadow maps. TextureLeases owns shared
source textures; no scene may dispose a leased texture directly. Partial preparation
registers disposers immediately and unwinds failures. Stale/aborted preparations
cannot install objects or callbacks. Scene disposal includes lights' shadow maps.
Frame-by-frame camera/light updates remain scene-local, with no Zustand writes.

Validation and measured limits will be recorded in `docs/validation/globe-lighting/`.
Node tests establish math/state/resource contracts, not browser or device coverage.

## Alternatives and consequences

A textured analytic sphere would not provide mountain silhouettes, so fixed-grid
ETOPO1 displacement is used. Two fixed detail levels avoid tile streaming and
adaptive tessellation: room120×60 and country360×180. Room loading omits country
polygons and uses reduced maps. No city terrain is requested. The four-entry atlas
LRU bounds retained city shards. Native PNGs remain the measured fallback; no
unverified compressed GPU format is required.

A sprite lamp could not show its interior from the table camera. The original
procedural mesh supplies lined shade, curved stem and layered base; painted
background and card surfaces remain unlit. One512² lamp shadow is the bounded
default, candle shadows remain disabled, and the same lamp supports no-shadow
rendering. A WebGL failure retains the HTML flow and a retry control.

[Validation](../validation/globe-lighting/README.md) and
[measurements](../validation/globe-lighting/performance.md) distinguish software
rendering from physical hardware. Changes to region membership, coordinate
conventions, private scene payloads or ownership require a superseding ADR.

The runtime inspects renderer capabilities locally. Known software rasterizers
(SwiftShader, llvmpipe, softpipe, Software Rasterizer), or max texture size below512,
select the measured no-lamp-shadow configuration through `SceneInstance.setShadows`.
Hardware and unknown renderers retain the single512² shadow. This is a conservative
capability policy, not an automatic FPS guarantee or physical-mobile qualification.
