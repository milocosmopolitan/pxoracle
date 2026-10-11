# Worldwide birthplace atlas

Source: [GeoNames downloadable gazetteer](https://download.geonames.org/export/dump/),
`cities15000.zip`, `admin1CodesASCII.txt` and `countryInfo.txt`, retrieved 2026-10-11. GeoNames licenses
coordinates, alternate names and the explicit IANA timezone field under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is bundled and
shown beside the chooser. See `provenance.json` for original download and retained
subset SHA-256 hashes. `source-world.tsv.gz` preserves all original city rows;
`source-admin1.tsv` and `source-countries.tsv` preserve administrative and country labels.
The previous US/Korea snapshot, provenance and public URLs remain for compatibility.

Run `python3 scripts/build-birthplace-atlas.py` offline to reproduce public shards.
Changes: group all source countries/territories, join English region names (country
label when an administrative name is missing), retain name/aliases/point/
zone, deduplicate aliases, sort numeric IDs, encode compact arrays. No nearest-city,
longitude-to-offset or polygon-based time zone inference occurs. GeoNames supplies
the timezone at its representative city point. We do not vendor a timezone boundary
polygon database or claim to resolve arbitrary coordinates to a zone.

Coverage: **34,159 cities across 244 countries and territories** in the pinned
cities15000 snapshot (population above 15,000 or capitals). This is worldwide city
coverage, not every settlement, postal address or historical place. Missing towns,
renamed places and border locations retain explicit manual coordinate/IANA correction.
Country labels and territorial groupings follow GeoNames; they are search categories,
not a claim about political recognition. Aliases lack language/historic-date metadata;
a match does not certify a name or jurisdiction on the birth date.

The 5,443-byte generated country catalog is part of the astrology UI. No city pack is
fetched before country selection. The versioned manifest is 60,336 raw / 16,486 gzip
bytes; only the chosen country's shard follows. The largest shard is US, 1,191,115 raw /
429,314 gzip bytes; Japan is 259,268 / 88,502, Nepal 11,754 / 4,717. All 244 shards total
7,867,316 raw / 2,967,334 gzip bytes, never an initial world download. Each shard stays
below the existing 1.5 MB / 5,000-city bounds. The manifest is capped at 100 KB.
These are gzip-equivalent measurements, not a claim about a local HTTP server.

Every country shard has version, byte length and SHA-256 validation. Search works
locally with native-script names, transliterations and accent normalization. No city
query, birth date or coordinates enter an atlas request. After load, cached search
works offline within the current page; no offline installation is claimed. Existing
`geonames-us-kr.2026-10-11` saved place provenance remains valid and does not cause
saved charts to be recalculated. New selections use `geonames-world.2026-10-11`.
The manifest URL itself is versioned so an older open app cannot receive the new
manifest under its previous contract.

Historical offsets come from the calculation engine's embedded chrono-tz, not these
current geographic assignments. [IANA's scope](https://www.iana.org/time-zones/theory)
warns that pre-1970 history is incomplete and location-representative. Modern zone
boundaries do not certify past civil practice. The manual correction route does not
silently use the browser timezone or current geolocation.
