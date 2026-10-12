"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { BirthInput } from "@pxoracle/contracts";
import type { Birthplace } from "@pxoracle/contracts/atlas";
import { useOracle, useOracleStore } from "../../state/store";
import type { BirthDraft, ConfirmedBirthplace } from "../../state/consultation";
import { globeCountries } from "@pxoracle/contracts/globe-geography";
import { GlobeChooser } from "./GlobeChooser";
import { ATLAS_CITY_COUNT } from "@pxoracle/contracts/atlas";
import { COUNTRIES, COUNTRY_OPTIONS, loadCities, searchCities } from "./atlas";

const finite = (value: string, limit: number) => value.trim() !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

/**
 * Birthplace exploration: region/country globe browsing, the country's city list or
 * manual coordinates. Choosing a city highlights a candidate; only Confirm commits it.
 */
export function BirthplaceForm({
  confirmed,
  onConfirm,
  onCancel,
}: {
  confirmed: ConfirmedBirthplace | null;
  onConfirm: (birthplace: ConfirmedBirthplace) => void;
  onCancel: () => void;
}) {
  const [ready, setReady] = useState(false);
  const navigation = useOracle(s => s.birthplace);
  const store = useOracleStore();
  const country = navigation.country ?? "";
  const chosen = navigation.candidate;
  const setChosen = (city: Birthplace | null) => city ? store.getState().chooseBirthplace(city, navigation.revision) : store.getState().clearBirthplaceCandidate();
  const [cities, setCities] = useState<Birthplace[]>([]);
  const [query, setQuery] = useState("");
  const [atlasStatus, setAtlasStatus] = useState("idle");
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(confirmed?.provenance.source === "manual");
  const [label, setLabel] = useState(confirmed?.provenance.source === "manual" ? confirmed.label : "");
  const [coordinates, setCoordinates] = useState({
    timezone: confirmed?.timezone ?? "",
    latitude: confirmed ? String(confirmed.latitude) : "",
    longitude: confirmed ? String(confirmed.longitude) : "",
  });
  useEffect(() => setReady(true), []);
  // Clear the old country, its candidate coordinates and zone before the replacement
  // input can receive typing. The first run keeps a previously confirmed place's values,
  // and a reset that lands after the reader already typed for this country is skipped,
  // so a slow commit (observed in WebKit) can never erase fresh input.
  const firstCountry = useRef(true);
  const typedFor = useRef(country);
  useLayoutEffect(() => {
    if (firstCountry.current) {
      firstCountry.current = false;
      return;
    }
    if (typedFor.current === country) return;
    setQuery("");
    setCities([]);
    setAtlasStatus("idle");
    setCoordinates({ timezone: "", latitude: "", longitude: "" });
  }, [country]);
  useEffect(() => {
    if (!country || manual) return;
    const abort = new AbortController();
    setAtlasStatus("loading");
    setCities([]);
    void loadCities(country, abort.signal).then(
      (result) => {
        if (!abort.signal.aborted) {
          setCities(result);
          setAtlasStatus("ready");
        }
      },
      () => {
        if (!abort.signal.aborted) setAtlasStatus("error");
      },
    );
    return () => abort.abort();
  }, [country, attempt, manual]);
  const results = useMemo(() => searchCities(cities, query), [cities, query]);
  function choose(city: Birthplace) {
    typedFor.current = country;
    setChosen(city);
    setQuery(city.name);
    setCoordinates({ timezone: city.timezone, latitude: String(city.latitude), longitude: String(city.longitude) });
  }
  const manualValid = manual && coordinates.timezone.trim() !== "" && finite(coordinates.latitude, 90) && finite(coordinates.longitude, 180);
  const atlasValid = !manual && !!chosen && chosen.country === country;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manual) {
      if (!manualValid) return;
      const text = label.trim() || (chosen ? `${chosen.name}, ${chosen.region}` : confirmed?.label) || "Manually entered birthplace";
      onConfirm({
        label: text,
        timezone: coordinates.timezone.trim(),
        latitude: Number(coordinates.latitude),
        longitude: Number(coordinates.longitude),
        provenance: { source: "manual", label: text, cityId: null, country: null, atlasVersion: null },
      });
      return;
    }
    if (!atlasValid) return;
    // Atlas provenance and coordinates must come from the same confirmed record.
    const city = chosen!;
    const text = `${city.name}, ${city.region}, ${COUNTRIES[city.country]}`;
    onConfirm({
      label: text,
      timezone: city.timezone,
      latitude: city.latitude,
      longitude: city.longitude,
      provenance: { source: "atlas", label: text, cityId: city.id, country: city.country, atlasVersion: city.atlasVersion },
    });
  }
  return (
    <form onSubmit={submit} className="birth-form birthplace-form" aria-label="Birthplace">
      <fieldset disabled={!ready}>
        <legend className="sr-only">Birthplace</legend>
        <p>
          Browse the globe by region and country, then pick the city from its list.
          Nothing leaves this browser; no location service is contacted.
        </p>
        <div className="actions">
          <button type="button" aria-pressed={!manual} onClick={() => setManual(false)}>
            Search a city
          </button>
          <button
            type="button"
            aria-pressed={manual}
            onClick={() => {
              if (!manual && chosen) setCoordinates({ timezone: chosen.timezone, latitude: String(chosen.latitude), longitude: String(chosen.longitude) });
              setManual(true);
            }}
          >
            Enter or adjust coordinates
          </button>
        </div>
        {!manual ? (
          <>
            <GlobeChooser />
            <label>
              Birth country
              <select
                value={country}
                onChange={(event) => {
                  if (event.target.value) store.getState().navigateBirthplace({ type: "country", country: event.target.value });
                  else store.getState().navigateBirthplace({ type: "region", region: navigation.region });
                  setChosen(null);
                  setQuery("");
                }}
                required
              >
                <option value="">Choose a country</option>
                {COUNTRY_OPTIONS.filter(([code]) => !navigation.region || globeCountries.find(c => c.code === code)?.regions.includes(navigation.region)).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
            <small>
              Search {ATLAS_CITY_COUNT.toLocaleString("en")} cities across {COUNTRY_OPTIONS.length} countries and territories.
              GeoNames covers cities above 15,000 people and capitals; smaller or missing places use manual entry.
            </small>
            {country && (
              <label>
                Birth city
                <input
                  type="search"
                  autoComplete="off"
                  maxLength={120}
                  value={query}
                  onChange={(event) => {
                    typedFor.current = country;
                    setQuery(event.target.value);
                    setChosen(null);
                  }}
                  placeholder="City, region or local name"
                  aria-describedby="city-help"
                />
              </label>
            )}
            {atlasStatus === "loading" && <p role="status">Loading this country’s local atlas…</p>}
            {atlasStatus === "error" && (
              <div role="alert">
                <p>The city data could not load. Your other details are unchanged.</p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry city data</button>
              </div>
            )}
            {!chosen && query.length >= 2 && atlasStatus === "ready" && (
              <>
                <p id="city-help">Select the city and region explicitly. Tab through results and press Enter.</p>
                <ul className="city-results" aria-label="Matching birth cities">
                  {results.map((city) => (
                    <li key={city.id}>
                      <button type="button" onClick={() => choose(city)}>
                        <strong>{city.name}</strong>
                        <span>{city.region}, {COUNTRIES[city.country]}</span>
                        <small>{city.timezone}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                {results.length === 0 && <p>No matching city in this atlas. Use manual entry for the exact location.</p>}
              </>
            )}
            {chosen && (
              <div className="place-confirmation" role="status">
                <strong>{chosen.name}, {chosen.region}, {COUNTRIES[chosen.country]}</strong>
                <p>{chosen.latitude}°, {chosen.longitude}° · {chosen.timezone}</p>
                <small>
                  This is a representative city point and current zone assignment. Near a boundary or for a
                  historical place, verify and adjust the coordinates and zone. The view stays still until you confirm.
                </small>
              </div>
            )}
          </>
        ) : (
          <>
            <label>
              Birthplace label (optional)
              <input name="placeLabel" autoComplete="off" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={chosen ? `${chosen.name}, ${chosen.region}` : undefined} />
            </label>
            <label>
              Birthplace time zone
              <input name="timezone" value={coordinates.timezone} onChange={(e) => setCoordinates((c) => ({ ...c, timezone: e.target.value }))} required autoComplete="off" placeholder="Asia/Seoul" />
              <small>Use an IANA zone. Your device zone is never substituted.</small>
            </label>
            <div className="two">
              {(["latitude", "longitude"] as const).map((key) => (
                <label key={key}>
                  {key === "latitude" ? "Latitude" : "Longitude"}
                  <input name={key} type="number" step="any" min={key === "latitude" ? -90 : -180} max={key === "latitude" ? 90 : 180} value={coordinates[key]} onChange={(e) => setCoordinates((c) => ({ ...c, [key]: e.target.value }))} required />
                </label>
              ))}
            </div>
            <small>Degrees: north/east positive, south/west negative.</small>
          </>
        )}
        <div className="actions">
          <button className="primary" disabled={!(manualValid || atlasValid)}>
            Confirm birthplace →
          </button>
          <button type="button" onClick={onCancel}>
            {confirmed ? "Keep the previous birthplace" : "Return to the table"}
          </button>
        </div>
        {confirmed && (
          <small>Currently confirmed: {confirmed.label}. Confirming a different place replaces it; returning keeps it.</small>
        )}
      </fieldset>
    </form>
  );
}

/** Date, accuracy and time at the consultation table, after the birthplace is confirmed. */
export function BirthDetailsForm({
  draft,
  onChange,
  onContinue,
}: {
  draft: BirthDraft;
  onChange: (draft: Partial<BirthDraft>) => void;
  onContinue: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const accuracy = draft.accuracy;
  return (
    <form
      className="birth-form birth-details-form"
      aria-label="Birth date and time"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <fieldset disabled={!ready}>
        <legend className="sr-only">Birth date and time</legend>
        <p>Use the local date and clock time recorded at your birthplace. These stay in memory until you choose Save.</p>
        <div className="two">
          <label>
            Birth date
            <input name="date" type="date" min="1900-01-01" max="2100-12-31" value={draft.date} onChange={(e) => onChange({ date: e.target.value })} required />
          </label>
          <label>
            Time accuracy
            <select name="accuracy" value={accuracy} onChange={(e) => onChange({ accuracy: e.target.value as BirthInput["accuracy"] })}>
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="unknown">I don’t know</option>
            </select>
          </label>
        </div>
        {accuracy !== "unknown" && (
          <div className="two">
            <label>
              Local birth time
              <input name="time" type="time" value={draft.time} onChange={(e) => onChange({ time: e.target.value })} required />
            </label>
            {accuracy === "approximate" && (
              <label>
                Uncertainty ± minutes
                <input name="uncertainty" type="number" min="1" max="720" value={draft.uncertaintyMinutes} onChange={(e) => onChange({ uncertaintyMinutes: Number(e.target.value) })} required />
              </label>
            )}
          </div>
        )}
        {accuracy !== "exact" && (
          <p className="hint">
            Only midpoint positions and sampled sign alternatives will be shown. These are not certified interval
            bounds. Ascendant, houses and aspects will be omitted.
          </p>
        )}
        <button className="primary">Review the details →</button>
      </fieldset>
    </form>
  );
}
