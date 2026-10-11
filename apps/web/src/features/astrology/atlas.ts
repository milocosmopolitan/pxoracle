import {
  ATLAS_VERSION,
  ATLAS_COUNTRIES,
  ATLAS_CITY_COUNT,
  type AtlasCountry,
  type Birthplace,
} from "@pxoracle/contracts/atlas";
export const COUNTRIES = ATLAS_COUNTRIES;
export { ATLAS_CITY_COUNT };
export const COUNTRY_OPTIONS = Object.entries(COUNTRIES).sort((a, b) => a[1].localeCompare(b[1], "en"));
interface Shard {
  label: string;
  file: string;
  count: number;
  bytes: number;
  sha256: string;
}
interface Manifest {
  version: string;
  countries: Record<AtlasCountry, Shard>;
}
const cache = new Map<AtlasCountry, Birthplace[]>();
let manifest: Manifest | undefined;
const indexes = new WeakMap<
  Birthplace[],
  { city: Birthplace; names: string[]; haystack: string }[]
>();
function indexCities(cities: Birthplace[]) {
  let index = indexes.get(cities);
  if (!index) {
    index = cities.map((city) => {
      const names = [city.name, ...city.aliases].map(normalizeCity);
      return {
        city,
        names,
        haystack: [
          ...names,
          normalizeCity(city.region),
          city.country.toLowerCase(),
        ].join(" "),
      };
    });
    indexes.set(cities, index);
  }
  return index;
}
export function normalizeCity(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function decodeCities(
  data: unknown,
  country: AtlasCountry,
): Birthplace[] {
  const pack = data as {
    version?: unknown;
    country?: unknown;
    cities?: unknown;
  };
  if (
    !pack ||
    pack.version !== ATLAS_VERSION ||
    pack.country !== country ||
    !Array.isArray(pack.cities) ||
    pack.cities.length > 5000
  )
    throw new Error("ATLAS_INVALID");
  const ids = new Set<string>();
  return pack.cities.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 7)
      throw new Error("ATLAS_INVALID");
    const [id, name, region, latitude, longitude, timezone, aliases] = row;
    if (
      ![id, name, region, timezone].every(
        (x) => typeof x === "string" && x.length > 0 && x.length <= 256,
      ) ||
      !/^[0-9]+$/.test(id) ||
      ids.has(id) ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180 ||
      !/^[A-Za-z_+-]+\/[A-Za-z_+\/-]+$/.test(timezone) ||
      !Array.isArray(aliases) ||
      aliases.length > 1000 ||
      !aliases.every((a) => typeof a === "string" && a.length <= 400)
    )
      throw new Error("ATLAS_INVALID");
    ids.add(id);
    return {
      id,
      name,
      region,
      country,
      latitude,
      longitude,
      timezone,
      aliases,
      atlasVersion: ATLAS_VERSION,
    };
  });
}
export function searchCities(
  cities: Birthplace[],
  query: string,
  limit = 30,
): Birthplace[] {
  const text = normalizeCity(query).slice(0, 120);
  if (text.length < 2) return [];
  const tokens = text.split(" ");
  return indexCities(cities)
    .map(({ city, names, haystack }) => {
      return {
        city,
        score: names.includes(text)
          ? 0
          : names.some((n) => n.startsWith(text))
            ? 1
            : 2,
        match: tokens.every((t) => haystack.includes(t)),
      };
    })
    .filter((x) => x.match)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.city.name.localeCompare(b.city.name, "en") ||
        a.city.region.localeCompare(b.city.region, "en") ||
        Number(a.city.id) - Number(b.city.id),
    )
    .slice(0, Math.min(100, Math.max(1, limit)))
    .map((x) => x.city);
}
async function bounded(url: string, limit: number, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (
    !response.ok ||
    Number(response.headers.get("content-length") || 0) > limit
  )
    throw new Error("ATLAS_LOAD_FAILED");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new Error("ATLAS_LOAD_FAILED");
  return bytes;
}
export async function loadCities(
  country: AtlasCountry,
  signal: AbortSignal,
): Promise<Birthplace[]> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (!Object.hasOwn(COUNTRIES, country)) throw new Error("ATLAS_INVALID");
  if (cache.has(country)) return cache.get(country)!;
  if (!manifest) {
    const data = JSON.parse(
      new TextDecoder().decode(
        await bounded(`/content/atlas/manifest.${ATLAS_VERSION}.json`, 100000, signal),
      ),
    ) as Manifest;
    if (
      data.version !== ATLAS_VERSION ||
      !data.countries ||
      Object.keys(data.countries).sort().join(",") !== Object.keys(COUNTRIES).sort().join(",")
    )
      throw new Error("ATLAS_INVALID");
    for (const key of Object.keys(COUNTRIES) as AtlasCountry[]) {
      const s = data.countries[key];
      if (
        !s ||
        s.label !== COUNTRIES[key] ||
        s.file !== `${key}.${ATLAS_VERSION}.json` ||
        !Number.isInteger(s.count) ||
        s.count < 1 ||
        s.count > 5000 ||
        !Number.isInteger(s.bytes) ||
        s.bytes < 1 ||
        s.bytes > 1500000 ||
        !/^[0-9a-f]{64}$/.test(s.sha256)
      )
        throw new Error("ATLAS_INVALID");
    }
    manifest = data;
  }
  const shard = manifest.countries[country];
  const bytes = await bounded(`/content/atlas/${shard.file}`, 1500000, signal);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== shard.sha256 || bytes.byteLength !== shard.bytes)
    throw new Error("ATLAS_INVALID");
  const cities = decodeCities(
    JSON.parse(new TextDecoder().decode(bytes)),
    country,
  );
  if (cities.length !== shard.count) throw new Error("ATLAS_INVALID");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  indexCities(cities);
  cache.set(country, cities);
  return cities;
}
