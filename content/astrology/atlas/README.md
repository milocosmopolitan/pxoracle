# Birthplace atlas, initial supported coverage

Source: [GeoNames downloadable gazetteer](https://download.geonames.org/export/dump/),
`cities15000.zip` and `admin1CodesASCII.txt`, retrieved 2026-10-11. GeoNames licenses
coordinates, alternate names and the explicit IANA timezone field under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is bundled and
shown beside the chooser. See `provenance.json` for original download and retained
subset SHA-256 hashes. `source-US-KR.tsv.gz` preserves the original selected rows;
`source-admin1.tsv` preserves their administrative names.

Run `python3 scripts/build-birthplace-atlas.py` offline to reproduce public shards.
Changes: filter country US/KR, join English region names, retain name/aliases/point/
zone, deduplicate aliases, sort numeric IDs, encode compact arrays. No nearest-city,
longitude-to-offset or polygon-based time zone inference occurs. GeoNames supplies
the timezone at its representative city point. We do not vendor a timezone boundary
polygon database or claim to resolve arbitrary coordinates to a zone.

Coverage: 3,408 US records and 147 South Korean records in that source's cities15000
selection (population above 15,000 or capitals). This is not all settlements, a
worldwide atlas, postal-address lookup or historical-city database. Missing towns,
renamed places and places near jurisdiction/timezone boundaries use explicit manual
coordinate and IANA-zone correction. Alternate names lack language/historic-date
metadata in this compact source; a search alias is not a claim that today's place
name/jurisdiction applied on the birth date.

Country shards are requested only after choosing a country on the astrology route.
No atlas loads on landing/tarot. Manifest is under 2 KB; US is 1,191,115 bytes
(429,314 gzip), Korea 32,536 bytes (12,067 gzip), from the checked-in snapshot. Download
and decoding have explicit caps and version/hash checks. Search thereafter works
without a network in the current page; this is not a promise of an offline service
worker or installation. No query text is sent to GeoNames or our server.

Historical offsets come from the calculation engine's embedded chrono-tz, not these
current geographic assignments. [IANA's scope](https://www.iana.org/time-zones/theory)
warns that pre-1970 history is incomplete and location-representative. Modern zone
boundaries do not certify past civil practice. The manual correction route does not
silently use the browser timezone or current geolocation.
