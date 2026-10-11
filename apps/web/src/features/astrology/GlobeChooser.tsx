"use client";
import { useOracle } from "../../state/store";
import { globeCountries } from "@pxoracle/contracts/globe-geography";
import type { GlobeRegion } from "@pxoracle/contracts/globe-view";
export const BROWSING_REGIONS: [GlobeRegion, string][] = [
  ["europe", "Europe"], ["asia", "Asia"], ["middle-east", "Middle East"],
  ["africa", "Africa"], ["north-america", "North America"],
  ["south-america", "South America"], ["oceania", "Oceania"],
];
export function GlobeChooser() {
  const state = useOracle(s => s.birthplace);
  const navigate = useOracle(s => s.navigateBirthplace);
  return <section className="globe-chooser" aria-label="Browse the birthplace globe">
    <div className="actions">
      <button type="button" onClick={() => navigate({type:"open"})}>Explore the globe</button>
      {state.phase !== "room" && <button type="button" onClick={() => navigate({type:"back"})}>Back one view</button>}
      {state.phase !== "room" && <button type="button" onClick={() => navigate({type:"cancel"})}>Room view</button>}
    </div>
    {state.phase !== "room" && <div className="actions" aria-label="Adjust globe view">
      <button type="button" aria-label="Turn globe west" onClick={() => navigate({type:"adjust",yaw:-8})}>←</button>
      <button type="button" aria-label="Turn globe east" onClick={() => navigate({type:"adjust",yaw:8})}>→</button>
      <button type="button" aria-label="Zoom globe out" onClick={() => navigate({type:"adjust",zoom:.12})}>−</button>
      <button type="button" aria-label="Zoom globe in" onClick={() => navigate({type:"adjust",zoom:-.12})}>+</button>
    </div>}
    <label>Browsing region
      <select value={state.region ?? ""} onChange={e => navigate({type:"region", region: (e.target.value || null) as GlobeRegion | null})}>
        <option value="">All countries</option>
        {BROWSING_REGIONS.map(([id,name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
    <small>Choose a country on the globe or in the list. City selection keeps this view still.</small>
    {state.country && globeCountries.find(c => c.code === state.country)?.geometryStatus === "missing" && <p role="status">This territory has no separate boundary in this map. Choose its city below; its atlas data is available.</p>}
    <details><summary>Regions and territories</summary><p>These are browsing groups, not political claims. Transcontinental countries can appear in more than one region. Territories keep their own atlas entries; All countries always includes every entry. Boundaries are generalized, and small places remain available in the list.</p></details>
  </section>;
}
