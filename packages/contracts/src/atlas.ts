export const ATLAS_VERSION = "geonames-us-kr.2026-10-11" as const;
export type AtlasCountry = "US" | "KR";
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
