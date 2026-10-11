"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BirthInput } from "@pxoracle/contracts";
import type {
  AtlasCountry,
  Birthplace,
  PlaceProvenance,
} from "@pxoracle/contracts/atlas";
import { COUNTRIES, loadCities, searchCities } from "./atlas";

export function BirthForm({
  initial,
  initialPlace,
  busy,
  error,
  onSubmit,
}: {
  initial?: BirthInput | null;
  initialPlace?: PlaceProvenance | null;
  busy: boolean;
  error: string;
  onSubmit: (input: BirthInput, place: PlaceProvenance) => void;
}) {
  const [ready, setReady] = useState(false);
  const [country, setCountry] = useState<AtlasCountry | "">("");
  const [cities, setCities] = useState<Birthplace[]>([]);
  const [query, setQuery] = useState("");
  const [atlasStatus, setAtlasStatus] = useState("idle");
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState<Birthplace | null>(null);
  const [manual, setManual] = useState(!!initial);
  const [accuracy, setAccuracy] = useState<BirthInput["accuracy"]>(
    initial?.accuracy ?? "exact",
  );
  const [coordinates, setCoordinates] = useState({
    timezone: initial?.timezone ?? "",
    latitude: initial ? String(initial.latitude) : "",
    longitude: initial ? String(initial.longitude) : "",
  });
  useEffect(() => setReady(true), []);
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
    setChosen(city);
    setQuery(city.name);
    setCoordinates({
      timezone: city.timezone,
      latitude: String(city.latitude),
      longitude: String(city.longitude),
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manual && !chosen) return;
    const data = new FormData(event.currentTarget);
    onSubmit(
      {
        date: String(data.get("date")),
        time: accuracy === "unknown" ? null : String(data.get("time")),
        accuracy,
        ...coordinates,
        latitude: Number(coordinates.latitude),
        longitude: Number(coordinates.longitude),
        uncertaintyMinutes:
          accuracy === "approximate" ? Number(data.get("uncertainty")) : null,
        fold: (data.get("fold") || null) as BirthInput["fold"],
      },
      manual
        ? {
            source: "manual",
            label: String(
              data.get("placeLabel") ||
                initialPlace?.label ||
                "Manually entered birthplace",
            ),
            cityId: null,
            country: null,
            atlasVersion: null,
          }
        : {
            source: "atlas",
            label: `${chosen!.name}, ${chosen!.region}, ${COUNTRIES[chosen!.country]}`,
            cityId: chosen!.id,
            country: chosen!.country,
            atlasVersion: chosen!.atlasVersion,
          },
    );
  }
  return (
    <form onSubmit={submit} className="birth-form">
      <fieldset disabled={!ready || busy}>
        <legend className="sr-only">Birth details</legend>
        <p>
          Your birth details stay in this browser’s memory until you choose
          Save. No location lookup service is contacted.
        </p>
        <div className="actions">
          <button
            type="button"
            aria-pressed={!manual}
            onClick={() => setManual(false)}
          >
            Search a city
          </button>
          <button
            type="button"
            aria-pressed={manual}
            onClick={() => setManual(true)}
          >
            Enter or adjust coordinates
          </button>
        </div>
        {!manual ? (
          <>
            <label>
              Birth country
              <select
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value as AtlasCountry | "");
                  setChosen(null);
                  setQuery("");
                }}
                required
              >
                <option value="">Choose a country</option>
                <option value="US">United States</option>
                <option value="KR">South Korea</option>
              </select>
            </label>
            <small>
              Local atlas: 3,408 US and 147 South Korean cities from GeoNames
              cities15000. Smaller or missing places and other countries use
              manual entry.
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
                    setQuery(event.target.value);
                    setChosen(null);
                  }}
                  placeholder="City, region or local name"
                  aria-describedby="city-help"
                />
              </label>
            )}
            {atlasStatus === "loading" && (
              <p role="status">Loading this country’s local atlas…</p>
            )}
            {atlasStatus === "error" && (
              <div role="alert">
                <p>
                  The city data could not load. Your other details are
                  unchanged.
                </p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                  Retry city data
                </button>
              </div>
            )}
            {!chosen && query.length >= 2 && atlasStatus === "ready" && (
              <>
                <p id="city-help">
                  Select the city and region explicitly. Tab through results and
                  press Enter.
                </p>
                <ul className="city-results" aria-label="Matching birth cities">
                  {results.map((city) => (
                    <li key={city.id}>
                      <button type="button" onClick={() => choose(city)}>
                        <strong>{city.name}</strong>
                        <span>
                          {city.region}, {COUNTRIES[city.country]}
                        </span>
                        <small>{city.timezone}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                {results.length === 0 && (
                  <p>
                    No matching city in this atlas. Use manual entry for the
                    exact location.
                  </p>
                )}
              </>
            )}
            {chosen && (
              <div className="place-confirmation" role="status">
                <strong>
                  {chosen.name}, {chosen.region}, {COUNTRIES[chosen.country]}
                </strong>
                <p>
                  {chosen.latitude}°, {chosen.longitude}° · {chosen.timezone}
                </p>
                <small>
                  This is a representative city point and current zone
                  assignment. Near a boundary or for a historical place, verify
                  and adjust the coordinates and zone.
                </small>
              </div>
            )}
          </>
        ) : (
          <>
            <label>
              Birthplace label (optional)
              <input
                name="placeLabel"
                autoComplete="off"
                maxLength={200}
                defaultValue={
                  chosen
                    ? `${chosen.name}, ${chosen.region}`
                    : initialPlace?.label
                }
              />
            </label>
            <label>
              Birthplace time zone
              <input
                name="timezone"
                value={coordinates.timezone}
                onChange={(e) =>
                  setCoordinates((c) => ({ ...c, timezone: e.target.value }))
                }
                required
                autoComplete="off"
                placeholder="Asia/Seoul"
              />
              <small>
                Use an IANA zone. Your device zone is never substituted.
              </small>
            </label>
            <div className="two">
              {(["latitude", "longitude"] as const).map((key) => (
                <label key={key}>
                  {key === "latitude" ? "Latitude" : "Longitude"}
                  <input
                    name={key}
                    type="number"
                    step="any"
                    min={key === "latitude" ? -90 : -180}
                    max={key === "latitude" ? 90 : 180}
                    value={coordinates[key]}
                    onChange={(e) =>
                      setCoordinates((c) => ({ ...c, [key]: e.target.value }))
                    }
                    required
                  />
                </label>
              ))}
            </div>
            <small>Degrees: north/east positive, south/west negative.</small>
          </>
        )}
        <div className="two">
          <label>
            Birth date
            <input
              name="date"
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              defaultValue={initial?.date}
              required
            />
          </label>
          <label>
            Time accuracy
            <select
              value={accuracy}
              onChange={(e) =>
                setAccuracy(e.target.value as BirthInput["accuracy"])
              }
            >
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
              <input
                name="time"
                type="time"
                defaultValue={initial?.time ?? undefined}
                required
              />
            </label>
            {accuracy === "approximate" && (
              <label>
                Uncertainty ± minutes
                <input
                  name="uncertainty"
                  type="number"
                  min="1"
                  max="720"
                  defaultValue={initial?.uncertaintyMinutes ?? 30}
                  required
                />
              </label>
            )}
          </div>
        )}
        {accuracy !== "exact" && (
          <p className="hint">
            Only midpoint positions and sampled sign alternatives will be shown.
            These are not certified interval bounds. Ascendant, houses and
            aspects will be omitted.
          </p>
        )}
        {error === "AMBIGUOUS_LOCAL_TIME" && (
          <label>
            This clock time occurred twice. Which occurrence is recorded?
            <select name="fold" required defaultValue="">
              <option value="">Choose an occurrence</option>
              <option value="earlier">
                Earlier, before the clock moved back
              </option>
              <option value="later">Later, after the clock moved back</option>
            </select>
          </label>
        )}
        {error === "NONEXISTENT_LOCAL_TIME" && (
          <p role="alert">
            The clock skipped this local time. Check the recorded date and time;
            we will not move it automatically.
          </p>
        )}
        <button className="primary" disabled={busy || (!manual && !chosen)}>
          {busy ? "Calculating…" : "Enter the crystal →"}
        </button>
      </fieldset>
    </form>
  );
}
