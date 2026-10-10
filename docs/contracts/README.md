# Boundary contracts, version 1

Rust DTOs generate JSON Schema through schemars (`scripts/generate-schemas.sh`). The resulting schemas and real engine fixtures are validated by `tests/schema.test.mjs`; browser DTO views are in `packages/contracts/src/index.ts`. Schema shape is not semantic validity: Rust also checks deck composition, state consistency, dates, coordinates, orbs, and supported versions.

## Worker

Request `{version:1,id:integer,payload}`; response `{version:1,id,ok:true,result}` or `{version:1,id,ok:false,error:{code}}`. One feature per worker. Initialization Promise deduplicates requests and evicts failures; client timeouts/errors terminate the worker and reject all pending operations. Retry creates a clean instance. UI request generations ignore stale astrology responses; tarot actions are serialized by an immediate lock.

Stable errors include PROTOCOL_VERSION, ENGINE_LOAD_FAILED, ENGINE_TIMEOUT, INVALID_INPUT, INVALID_SETTINGS, INVALID_SESSION, INCOMPATIBLE_SESSION, NONEXISTENT_LOCAL_TIME, AMBIGUOUS_LOCAL_TIME, INVALID_TIMEZONE, UNSUPPORTED_DATE, SPREAD_FULL, NOT_SELECTED. Messages must not include input values.

C ABI input is a NUL-terminated UTF-8 allocation made with the module allocator and freed by JS. Output is a Rust CString; JS copies it and calls px_free once. No pointers leave the Worker or enter Zustand.

## Astrology

Degrees, east-positive longitude, north-positive latitude. Apparent geocentric true ecliptic of date. UTC treated as UT1; TT comes from backend delta-T. IANA time zone required. Fold must be selected explicitly; gaps rejected. Unknown means local midnight to next local midnight, not 24 fixed hours or invented noon. Missing/skipped local midnight is rejected explicitly.

Whole Sign starts at the sign containing ASC. Angles omitted for uncertain time or polar policy. Major aspects use shortest circular distance, inclusive configured orbs, stable body/pair/type order. Interpretation references identify bodies/aspects separately from calculated values.

## Tarot

Standard IDs: major.00–major.21, then wands/cups/swords/pentacles.01–.14. Courts: .11 Page, .12 Knight, .13 Queen, .14 King. Meaning/card art/content identity is independent.

Creation fixes all 78 card identities and directions. Selection is slot-to-permutation lookup, not a new random draw. Repeated selection/reveal is idempotent. Selection is limited by spread, reveal requires prior selection. Reading starts after all selected cards are revealed. Complete is explicit and idempotent. Restoring validates actual permutation, selection consistency, orientations, versions, and state; it does not rerun a seed.

The full serialized deck is client-local, inspectable by a determined user, and may be stored to resume unfinished readings. This is not a secrecy or gambling boundary. Scene view models contain only visible counts/positions and disclosed chart data.

## Scene and resource ownership

`prepare → enter → update → exit → dispose`. A route intent immediately cancels pending preparation. Old promises may finish but cannot activate. Failed/stale preparation releases every acquired texture lease and geometry/material. Shared textures live until their final lease releases. Resize observer, context listener, animation frame, and renderer are owned by runtime and released on teardown. Application state lives outside this lifecycle. Reduced motion suppresses transitions and expression cycling; frozen Storybook time is deterministic.

## Persistence

Envelope `{schemaVersion:1,value}` with feature-specific key. Explicit save and delete only. No automatic persistence/hydration. Tarot restore goes through Rust. Astrology saved settings are recalculated through Rust; the original chart result remains in memory across route changes. Incompatible/corrupt data is rejected. Quota/storage errors stay in the UI.
