import { globeCountries } from "@pxoracle/contracts/globe-geography";
import { ATLAS_COUNTRIES, type Birthplace } from "@pxoracle/contracts/atlas";
import type { GlobeIntent, GlobePhase, GlobeRegion } from "@pxoracle/contracts/globe-view";

export interface BirthplaceNavigation {
  phase: GlobePhase;
  region: GlobeRegion | null;
  country: keyof typeof ATLAS_COUNTRIES | null;
  candidate: Birthplace | null;
  revision: number;
  adjustment: { yaw?: number; pitch?: number; zoom?: number } | null;
}
export const emptyBirthplace = (): BirthplaceNavigation => ({ phase: "room", region: null, country: null, candidate: null, adjustment: null, revision: 0 });
export function navigateBirthplace(state: BirthplaceNavigation, intent: GlobeIntent): BirthplaceNavigation {
  const revision = state.revision + 1;
  switch (intent.type) {
    case "adjust": return state.phase === "room" || state.phase === "crystal" ? state : { ...state, revision, adjustment: {yaw:intent.yaw,pitch:intent.pitch,zoom:intent.zoom} };
    case "open": return { ...state, adjustment: null, phase: state.country ? "country" : state.region ? "region" : "overview", revision };
    case "region": return { ...state, adjustment: null, phase: intent.region ? "region" : "overview", region: intent.region, country: null, candidate: null, revision };
    case "country":
      if (!Object.hasOwn(ATLAS_COUNTRIES, intent.country)) return state;
      return { ...state, adjustment: null, phase: "country", region: state.region && globeCountries.find(c => c.code === intent.country)?.regions.includes(state.region) ? state.region : null, country: intent.country as BirthplaceNavigation["country"], candidate: null, revision };
    case "back":
      if (state.phase === "country") return { ...state, adjustment: null, phase: state.region ? "region" : "overview", country: null, candidate: null, revision };
      if (state.phase === "region") return { ...state, adjustment: null, phase: "overview", region: null, country: null, candidate: null, revision };
      return { ...state, adjustment: null, phase: "room", revision };
    case "cancel": return { ...state, adjustment: null, phase: "room", revision };
  }
}
/** A late result cannot select a city belonging to an abandoned country. No camera revision. */
export function chooseBirthplace(state: BirthplaceNavigation, city: Birthplace, revision: number): BirthplaceNavigation {
  if (revision !== state.revision || city.country !== state.country) return state;
  return { ...state, candidate: city };
}
