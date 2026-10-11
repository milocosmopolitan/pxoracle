"use client";
import { SIGNS, type BirthInput, type Chart } from "@pxoracle/contracts";
import type {
  InterpretationPlan,
  NatalEvidence,
  NatalItem,
} from "@pxoracle/contracts/natal";
import type { AstrologySelection } from "@pxoracle/contracts/astrology-view";
import type { NatalArticle, NatalContent } from "./content";
export const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function degrees(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const minute = Math.min(1799, Math.floor((normalized % 30) * 60 + 1e-8));
  return `${SIGNS[Math.floor(normalized / 30)]} ${Math.floor(minute / 60)}°${String(minute % 60).padStart(2, "0")}′`;
}
export function evidenceLabel(e: NatalEvidence) {
  const bodies = e.bodies.map(titleCase).join(" & ");
  return e.kind === "aspect"
    ? `${bodies} · ${e.aspect} · orb ${e.orb?.toFixed(2)}°`
    : `${bodies}${e.sign != null ? ` in ${SIGNS[e.sign!]}` : ""}${e.house != null ? ` · house ${e.house}` : ""}`;
}
export function itemSelection(item: NatalItem): AstrologySelection {
  const e = item.evidence[0];
  if (e.kind === "aspect")
    return { type: "aspect", a: e.bodies[0], b: e.bodies[1], kind: e.aspect! };
  return e.bodies[0] === "ascendant" ? null : { type: "body", id: e.bodies[0] };
}
function Paragraphs({
  article,
  compact = false,
}: {
  article: NatalArticle;
  compact?: boolean;
}) {
  return (
    <>
      <p>{article.body}</p>
      {!compact && (
        <>
          <p>
            <strong>A useful practice.</strong> {article.constructive}
          </p>
          <p>
            <strong>A tension to notice.</strong> {article.tension}
          </p>
          <p className="reflection">
            <strong>Reflect.</strong> {article.question}
          </p>
        </>
      )}
    </>
  );
}
export function Placement({
  item,
  content,
  onSelect,
  open = false,
}: {
  item: NatalItem;
  content: NatalContent;
  onSelect: (s: AstrologySelection) => void;
  open?: boolean;
}) {
  const article = content.articles[item.reference];
  return (
    <details className="natal-placement" open={open || undefined}>
      <summary>{evidenceLabel(item.evidence[0])}</summary>
      <p className="eyebrow">
        {item.scope === "generational"
          ? "Shared generational background"
          : item.scope === "social"
            ? "Social context"
            : "Personal chart context"}
        {item.evidence[0].certainty === "sampled"
          ? " · conditional sample"
          : ""}
      </p>
      {item.fallback && (
        <p className="hint">
          Pair-level fallback: this configuration has no witness in the
          supported-date daily sample. No aspect-specific personal claim is
          made.
        </p>
      )}
      <h4>{article.summary}</h4>
      <Paragraphs article={article} />
      <button onClick={() => onSelect(itemSelection(item))}>
        Show in the crystal
      </button>
      <small className="rule-evidence">
        {item.ruleId} · {item.reference}
      </small>
    </details>
  );
}
export function HistoricalTime({ chart }: { chart: Chart }) {
  const input = chart.provenance.settings as BirthInput;
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = (input.time ?? "00:00").split(":").map(Number);
  const utc =
    input.accuracy === "unknown"
      ? Date.parse(chart.interval[0])
      : (Date.parse(chart.interval[0]) + Date.parse(chart.interval[1])) / 2;
  const offset = Math.round(
    (Date.UTC(
      year,
      month - 1,
      day,
      input.accuracy === "unknown" ? 0 : hour,
      input.accuracy === "unknown" ? 0 : minute,
    ) -
      utc) /
      1000,
  );
  const absolute = Math.abs(offset),
    h = Math.floor(absolute / 3600),
    m = Math.floor((absolute % 3600) / 60),
    s = absolute % 60;
  return (
    <div className="historical-time">
      <p>
        <strong>Resolved historical time</strong>
        <br />
        {input.timezone} · UTC{offset < 0 ? "−" : "+"}
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
        {s ? `:${String(s).padStart(2, "0")}` : ""}
        {input.accuracy === "unknown"
          ? " at local day start"
          : " at the recorded time"}
      </p>
      <small>
        {chart.interval[0] === chart.interval[1]
          ? chart.interval[0]
          : `${chart.interval[0]} → ${chart.interval[1]}`}{" "}
        · IANA {String(chart.provenance.timezoneDatabase)}
        {input.fold ? ` · ${input.fold} clock occurrence` : ""}
      </small>
    </div>
  );
}
export function NatalReport({
  chart,
  plan,
  content,
  onSelect,
}: {
  chart: Chart;
  plan: InterpretationPlan;
  content: NatalContent;
  onSelect: (s: AstrologySelection) => void;
}) {
  const all = new Map(
    [...plan.placements, ...plan.aspects].map((item) => [item.id, item]),
  );
  const article = (ref: string) => content.articles[ref];
  const distribution =
    plan.certainty === "exact"
      ? plan.distribution.exactElements
      : plan.distribution.sampledElements;
  const modalities =
    plan.certainty === "exact"
      ? plan.distribution.exactModalities
      : plan.distribution.sampledModalities;
  return (
    <article className="natal-report" aria-label="Full natal report">
      <header>
        <p className="eyebrow">YOUR WHOLE SIGN REPORT</p>
        <h2>A map, with room for you.</h2>
        <p>
          Tropical · geocentric · Whole Sign. Original symbolic interpretation
          for reflection.
        </p>
      </header>
      {plan.overviewRefs.map((ref) => (
        <section key={ref} className="report-introduction">
          <h3>{article(ref).summary}</h3>
          <Paragraphs article={article(ref)} compact />
        </section>
      ))}
      <section aria-labelledby="core-map-title">
        <h3 id="core-map-title">Your core map</h3>
        {plan.coreIds.map((id) => (
          <Placement
            key={id}
            item={all.get(id)!}
            content={content}
            onSelect={onSelect}
            open
          />
        ))}
      </section>
      <section aria-labelledby="themes-title">
        <h3 id="themes-title">Themes in conversation</h3>
        {plan.themes.length ? (
          plan.themes.map((item) => (
            <section className="natal-theme" key={item.id}>
              <h4>{article(item.reference).summary}</h4>
              <Paragraphs article={article(item.reference)} />
              <div className="evidence-links" aria-label="Chart evidence">
                {item.evidence.map((e, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      onSelect(
                        e.bodies[0] === "ascendant"
                          ? null
                          : { type: "body", id: e.bodies[0] },
                      )
                    }
                  >
                    {evidenceLabel(e)}
                  </button>
                ))}
              </div>
              <small className="rule-evidence">{item.ruleId}</small>
            </section>
          ))
        ) : (
          <p>{article("overview.no-pattern").body}</p>
        )}
      </section>
      <section aria-labelledby="important-relations">
        <h3 id="important-relations">Important relationships</h3>
        <p>
          Selected by personal relevance, aspect type and relative orb, with
          stable ties. This order is editorial emphasis, not a quality or
          personality score.
        </p>
        {plan.importantAspectIds.map((id) => (
          <Placement
            key={id}
            item={all.get(id)!}
            content={content}
            onSelect={onSelect}
          />
        ))}
        {!plan.importantAspectIds.length && (
          <p>{article("overview.no-aspects").body}</p>
        )}
      </section>
      <section aria-labelledby="life-topics">
        <h3 id="life-topics">Life topics</h3>
        {plan.topics.map((topic) => (
          <section key={topic.topic} className="life-topic">
            <h4>{article(topic.reference).summary}</h4>
            <Paragraphs article={article(topic.reference)} compact />
            {topic.itemIds.map((id) => (
              <div key={id}>
                <button onClick={() => onSelect(itemSelection(all.get(id)!))}>
                  {evidenceLabel(all.get(id)!.evidence[0])}
                </button>
                <p>{article(all.get(id)!.reference).summary}</p>
              </div>
            ))}
            <p className="reflection">{article(topic.reference).question}</p>
          </section>
        ))}
      </section>
      <section>
        <h3>Every supported placement</h3>
        <p>
          Open any placement for its full discussion, constructive practice,
          tension and reflection question.
        </p>
        {plan.placements.map((item) => (
          <Placement
            key={item.id}
            item={item}
            content={content}
            onSelect={onSelect}
          />
        ))}
      </section>
      <section>
        <h3>Every supported major relationship</h3>
        {plan.aspects.map((item) => (
          <Placement
            key={item.id}
            item={item}
            content={content}
            onSelect={onSelect}
          />
        ))}
      </section>
      <section>
        <h3>Elements and modalities</h3>
        <p>
          {plan.certainty === "exact"
            ? "Unweighted counts of ten calculated placements."
            : "Counts of bodies with a single observed sampled sign. These are not certified interval distributions."}{" "}
          Counts describe this map, not personal abilities or deficiencies.
        </p>
        <dl className="distribution">
          {["Fire", "Earth", "Air", "Water"].map((label, i) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{distribution[i]}</dd>
            </div>
          ))}
          {["Cardinal", "Fixed", "Mutable"].map((label, i) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{modalities[i]}</dd>
            </div>
          ))}
        </dl>
        {plan.distribution.ambiguousBodies.length > 0 && (
          <p>
            Excluded from fixed counts because multiple signs were sampled:{" "}
            {plan.distribution.ambiguousBodies.map(titleCase).join(", ")}.
          </p>
        )}
      </section>
      <section>
        <h3>Calculation table</h3>
        <div className="table-scroll">
          <table>
            <caption>
              {plan.certainty === "sampled"
                ? "Representative midpoint positions, not exact-time placements"
                : "Calculated positions"}
            </caption>
            <thead>
              <tr>
                <th>Body</th>
                <th>Longitude</th>
                <th>House</th>
                <th>Motion</th>
              </tr>
            </thead>
            <tbody>
              {chart.bodies.map((body) => (
                <tr key={body.id}>
                  <th>
                    <button
                      onClick={() => onSelect({ type: "body", id: body.id })}
                    >
                      {titleCase(body.id)}
                    </button>
                  </th>
                  <td>
                    {degrees(body.longitude)}
                    {plan.certainty === "sampled" && (
                      <small>
                        Observed:{" "}
                        {body.possibleSigns.map((s) => SIGNS[s]).join(" / ")}
                      </small>
                    )}
                  </td>
                  <td>{body.house ?? "Unavailable"}</td>
                  <td>
                    {body.speed < 0 ? "Retrograde" : "Direct"} ·{" "}
                    {body.speed.toFixed(4)}°/day
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chart.angles && (
          <p>
            Ascendant: {degrees(chart.angles.asc)} · Midheaven:{" "}
            {degrees(chart.angles.mc)}
          </p>
        )}
        <HistoricalTime chart={chart} />
        <p>
          Astronomy Engine C · apparent geocentric true ecliptic/equinox of
          date.
        </p>
        {chart.warnings.map((warning) => (
          <p key={warning} className="hint">
            {warning}
          </p>
        ))}
      </section>
      <section>
        <h3>Terms and limits</h3>
        {Object.entries(content.glossary).map(([term, text]) => (
          <details key={term}>
            <summary>{titleCase(term)}</summary>
            <p>{text}</p>
          </details>
        ))}
      </section>
      <footer>
        <p>
          Calculation {plan.versions.calculation} · Interpretation{" "}
          {plan.versions.interpretation} · {plan.versions.semantics} ·{" "}
          {plan.versions.rules} · {plan.versions.content}
        </p>
        <p>
          These passages were authored for PXOracle. Astrology is used here as a
          symbolic reflective practice, not a scientific assessment or
          prediction.
        </p>
      </footer>
    </article>
  );
}
