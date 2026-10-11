"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { SIGNS, type BirthInput, type Chart } from "@pxoracle/contracts";
import { useOracle } from "../state/store";
import { ErrorNotice, Loading, saveReading, readReading } from "./shared";
import astrologyContent from "../../../../content/astrology/en.v1.json";
import {validateBirth,validateChart} from "./persistence-validators";
const meanings:Record<string,string> = astrologyContent.meanings;
export default function Astrology({
  engine: providedEngine,
}: {
  engine?: Pick<
    typeof import("@pxoracle/engine-client/astrology"),
    "calculate"
  >;
} = {}) {
  const chart = useOracle((s) => s.chart),
    setChart = useOracle((s) => s.setChart),
    selected = useOracle((s) => s.selectedBody),
    setBody = useOracle((s) => s.setBody);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accuracy, setAccuracy] = useState<BirthInput["accuracy"]>((chart?.provenance.settings as BirthInput|undefined)?.accuracy??"exact"),
    [notice, setNotice] = useState("");
  const lastInput = useRef<BirthInput | null>((chart?.provenance.settings as BirthInput|undefined)??null);
  const request = useRef(0);
  useEffect(
    () => () => {
      ++request.current;
    },
    [],
  );
  async function calculate(input: BirthInput) {
    const id = ++request.current;
    lastInput.current = input;
    setAccuracy(input.accuracy);
    setBusy(true);
    setError("");
    try {
      const engine =
        providedEngine ?? (await import("@pxoracle/engine-client/astrology"));
      const result = await engine.calculate(input);
      if (id === request.current) setChart(result);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void calculate({
      date: String(f.get("date")),
      time: accuracy === "unknown" ? null : String(f.get("time")),
      timezone: String(f.get("timezone")),
      latitude: Number(f.get("latitude")),
      longitude: Number(f.get("longitude")),
      accuracy,
      fold: (f.get("fold") || null) as BirthInput["fold"],
      uncertaintyMinutes:
        accuracy === "approximate" ? Number(f.get("uncertainty")) : null,
    });
  }
  const body = chart?.bodies.find((x) => x.id === selected);
  return (
    <div className="feature-layout">
      <section className="scene-label">
        <Link href="/" prefetch={false}>
          ← Back to the room
        </Link>
        <p className="eyebrow">THE CELESTIAL MIRROR</p>
        <h1 tabIndex={-1}>
          A sky that
          <br />
          <em>began with you.</em>
        </h1>
        <p>
          The points follow your chart’s longitudes.
          <br />
          Their size and spacing are an artistic view.
        </p>
      </section>
      <section className="panel astrology-panel">
        <p className="eyebrow">
          {chart ? "YOUR NATAL CHART" : "A PLACE. A MOMENT. YOU."}
        </p>
        {!chart ? (
          <>
            <h2>Where did your story begin?</h2>
            <p>Enter the local time recorded at your birthplace.</p>
            <form onSubmit={submit}>
              <fieldset disabled={!ready || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div className="two">
                <label>
                  Birth date
                  <input
                    name="date"
                    defaultValue={lastInput.current?.date}
                    type="date"
                    min="1900-01-01"
                    max="2100-12-31"
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
                    <input name="time" type="time" defaultValue={lastInput.current?.time??undefined} required />
                  </label>
                  {accuracy === "approximate" && (
                    <label>
                      ± minutes
                      <input
                        name="uncertainty"
                        type="number"
                        min="1"
                        max="720"
                        defaultValue="30"
                        required
                      />
                    </label>
                  )}
                </div>
              )}
              <label>
                Birthplace time zone
                <input
                  name="timezone"
                  defaultValue={lastInput.current?.timezone}
                  placeholder="America/New_York"
                  required
                  autoComplete="off"
                />
                <small>
                  Use an IANA name, such as Asia/Seoul. Your current device zone
                  is never substituted.
                </small>
              </label>
              <div className="two">
                <label>
                  Latitude
                  <input
                    name="latitude"
                    defaultValue={lastInput.current?.latitude}
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    placeholder="40.7128"
                    required
                  />
                </label>
                <label>
                  Longitude
                  <input
                    name="longitude"
                    defaultValue={lastInput.current?.longitude}
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    placeholder="-74.0060"
                    required
                  />
                </label>
              </div>
              <small>
                Degrees: north/east positive, south/west negative. No location
                is sent to a lookup service.
              </small>
              <label>
                When the clock repeats
                <select name="fold" defaultValue="">
                  <option value="">Ask me if ambiguous</option>
                  <option value="earlier">Earlier occurrence</option>
                  <option value="later">Later occurrence</option>
                </select>
              </label>
              {accuracy !== "exact" && (
                <p className="hint">
                  We’ll show sampled possible signs. Ascendant, houses, and
                  aspects will be omitted.
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Calculating…" : "Enter the crystal →"}
              </button>
              </fieldset>
            </form>
          </>
        ) : (
          <>
            <div className="panel-heading">
              <h2>Your celestial map</h2>
              <button onClick={() => setChart(null)}>Edit details</button>
            </div>
            {chart.interval[0]!==chart.interval[1] && <p className="hint" role="status">Birth time is uncertain. These positions are midpoint samples; possible signs are sampled across the interval. Ascendant, houses and aspects are omitted.</p>}
            {chart.angles && (
              <p className="hint">
                Ascendant · {SIGNS[Math.floor(chart.angles.asc / 30)]}{" "}
                {(chart.angles.asc % 30).toFixed(1)}°<br />
                Midheaven · {SIGNS[Math.floor(chart.angles.mc / 30)]}{" "}
                {(chart.angles.mc % 30).toFixed(1)}°
              </p>
            )}
            <div className="planets" aria-label="Select a celestial body">
              {chart.bodies.map((b) => (
                <button
                  key={b.id}
                  aria-pressed={selected === b.id}
                  onClick={() => setBody(b.id)}
                >
                  <strong>{b.id}</strong>
                  <span>
                    {SIGNS[b.sign]} {b.degree.toFixed(1)}°
                    {b.speed < 0 ? " ℞" : ""}
                  </span>
                </button>
              ))}
            </div>
            {body && (
              <article className="body-reading">
                <p className="eyebrow">
                  {body.id} · {SIGNS[body.sign]}
                  {body.house ? ` · HOUSE ${body.house}` : ""}
                </p>
                <h3>{meanings[body.meaningRef]}</h3>
                {body.possibleSigns.length > 1 && (
                  <p>
                    Possible signs in the sampled interval:{" "}
                    {body.possibleSigns.map((s) => SIGNS[s]).join(", ")}.
                  </p>
                )}
                <small>
                  This is symbolic interpretation, separate from the
                  astronomical calculation.
                </small>
              </article>
            )}
            <details>
              <summary>
                Planetary relationships ({chart.aspects.length})
              </summary>
              {chart.aspects.map((a, i) => (
                <p key={i}>
                  {a.a} — {a.kind} — {a.b} · orb {a.orb.toFixed(2)}°<br/>{meanings[a.meaningRef]}
                </p>
              ))}
            </details>
            <details>
              <summary>Calculation & uncertainty</summary>
              <p>{chart.interval.join(" → ")}</p>
              {chart.warnings.map((x) => (
                <p key={x}>{x}</p>
              ))}
              <p>Tropical · geocentric · Whole Sign · Astronomy Engine C</p>
            </details>
            <div className="actions">
              <button
                onClick={() => {
                  try {
                    saveReading(
                      "astrology-chart",
                      {input:lastInput.current ?? chart.provenance.settings,chart},
                    );
                    setNotice("Chart and birth details saved on this device.");
                  } catch {
                    setNotice("This browser could not save the reading.");
                  }
                }}
              >
                Save on this device
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("pxoracle.astrology.v1");
                    localStorage.removeItem("pxoracle.astrology-chart.v1");
                    setNotice("Saved chart and birth details deleted.");
                  } catch {
                    setNotice("Storage is unavailable.");
                  }
                }}
              >
                Delete saved chart
              </button>
            </div>
          </>
        )}
        {busy && <Loading />}
        {error && (
          <ErrorNotice
            code={error}
            retry={
              lastInput.current
                ? () => void calculate(lastInput.current!)
                : undefined
            }
          />
        )}
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            try {
              const saved = readReading("astrology-chart") as {input:unknown;chart:unknown}|null;
              if(saved){
                if(!validateBirth(saved.input)||!validateChart(saved.chart)||(saved.chart as Chart).schemaVersion!==1||(saved.chart as Chart).engineVersion!=="0.1.0")throw new Error("INCOMPATIBLE_SESSION");
                lastInput.current=saved.input as BirthInput;
                setAccuracy(lastInput.current.accuracy);
                setChart(saved.chart as Chart);
                setNotice("Saved chart restored without recalculation.");
              }else{
                const legacy=readReading("astrology");
                if(legacy&&validateBirth(legacy))void calculate(legacy as BirthInput);
                else setNotice("No saved chart on this device.");
              }
            } catch {
              setError("INCOMPATIBLE_SESSION");
            }
          }}
        >
          Open saved chart
        </button>
        {notice && <p role="status">{notice}</p>}
      </section>
    </div>
  );
}
