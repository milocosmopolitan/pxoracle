export const ATLAS_VERSION = "geonames-world.2026-10-11" as const;
export { ATLAS_COUNTRIES, ATLAS_CITY_COUNT } from "./atlas-countries";
import type { ATLAS_COUNTRIES } from "./atlas-countries";
export type AtlasCountry = keyof typeof ATLAS_COUNTRIES;
export interface Birthplace {
  id: string;
  name: string;
  region: string;
  country: AtlasCountry;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases: string[];
  atlasVersion: string;
}
export interface PlaceProvenance {
  source: "atlas" | "manual";
  label: string;
  cityId: string | null;
  country: AtlasCountry | null;
  atlasVersion: string | null;
}
