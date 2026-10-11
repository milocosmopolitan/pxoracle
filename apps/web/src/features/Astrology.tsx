"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  AstrologySelection,
  AstrologyView,
} from "@pxoracle/contracts/astrology-view";
import { useOracle, useOracleStore } from "../state/store";
import { ErrorNotice } from "./shared";
import { BirthForm } from "./astrology/BirthForm";
import { useNatal, type NatalEngine } from "./astrology/useNatal";
import {
  degrees,
  evidenceLabel,
  itemSelection,
  HistoricalTime,
  NatalReport,
  Placement,
  titleCase,
} from "./astrology/Report";

export default function Astrology({ engine }: { engine?: NatalEngine } = {}) {
  const chart = useOracle((s) => s.chart),
    natal = useOracle((s) => s.natal);
  const birthplace = useOracle(s => s.birthplace);
  const store = useOracleStore();
  const controller = useNatal(engine);
  const entryPending = useOracle(s => s.globeEntryPending);
  const [preferAtlas, setPreferAtlas] = useState(entryPending);
  useEffect(() => {
    if (!entryPending) return;
    store.getState().consumeGlobeEntry();
    setPreferAtlas(true);
    if (store.getState().chart) controller.edit();
  }, [entryPending, store, controller]);
  const [full, setFull] = useState(false);
  const [sceneSettled, setSceneSettled] = useState(false);
  const cameraRequest = useRef(0);
  const onSettled = useCallback((revision: number) => {
    if (revision === cameraRequest.current) setSceneSettled(true);
  }, []);
  const stage = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [natal.revision]);
  useEffect(() => {
    const report = panel.current?.querySelector<HTMLElement>(".natal-report");
    if (full && report && panel.current)
      panel.current.scrollTop +=
        report.getBoundingClientRect().top -
        panel.current.getBoundingClientRect().top -
        20;
  }, [full]);
  useEffect(() => {
    const detail = panel.current?.querySelector<HTMLElement>(
      '[aria-label="Selected chart detail"]',
    );
    if (detail && panel.current)
      panel.current.scrollTop +=
        detail.getBoundingClientRect().top -
        panel.current.getBoundingClientRect().top -
        20;
  }, [natal.selection, full]);
  const [viewport, setViewport] = useState<AstrologyView["viewport"]>({
    left: 0,
    top: 0.15,
    width: 0.55,
    height: 0.8,
  });
  const select = useCallback(
    (selection: AstrologySelection) => {
      if (selection) setFull(false);
      store.getState().setNatal({ selection });
      store
        .getState()
        .setBody(selection?.type === "body" ? selection.id : null);
    },
    [store],
  );
  useEffect(() => {
    const measure = () => {
      const rect = stage.current?.getBoundingClientRect();
      if (!rect) return;
      const w = window.innerWidth,
        h = window.innerHeight;
      const left = Math.max(0, rect.left),
        top = Math.max(0, rect.top);
      const next = {
        left: left / w,
        top: top / h,
        width: Math.max(1, Math.min(w, rect.right) - left) / w,
        height: Math.max(1, Math.min(h, rect.bottom) - top) / h,
      };
      setViewport((old) =>
        Object.keys(next).every(
          (key) =>
            Math.abs(
              old[key as keyof typeof old] - next[key as keyof typeof next],
            ) < 0.001,
        )
          ? old
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stage.current) observer.observe(stage.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);
  useEffect(() => {
    setSceneSettled(false);
    const revision = ++cameraRequest.current;
    store.getState().setAstrologyView({
      phase: chart ? "chart" : "entry",
      revision,
      bodies:
        chart?.bodies.map(({ id, longitude }) => ({ id, longitude })) ?? [],
      houses: chart?.houses ?? null,
      aspects: chart?.aspects.map(({ a, b, kind }) => ({ a, b, kind })) ?? [],
      selection: natal.selection,
      viewport,
      onSelect: select,
      onSettled,
    });
  }, [
    chart,
    natal.revision,
    natal.selection,
    viewport,
    select,
    onSettled,
    store,
  ]);
  useEffect(() => {
    store.getState().setGlobeView({
      phase: chart ? "crystal" : birthplace.phase,
      region: birthplace.region, country: birthplace.country, revision: birthplace.revision, adjustment: birthplace.adjustment, viewport,
      onIntent: store.getState().navigateBirthplace,
    });
  }, [chart, birthplace.phase, birthplace.region, birthplace.country, birthplace.revision, birthplace.adjustment, viewport, store]);
  useEffect(() => () => { store.getState().setAstrologyView(undefined); store.getState().setGlobeView(undefined); }, [store]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [select]);
  useEffect(() => {
    if (!chart) setFull(false);
  }, [chart]);
  const selectedItems = natal.plan
    ? [...natal.plan.placements, ...natal.plan.aspects].filter((item) => {
        const evidence = item.evidence[0],
          selected = natal.selection;
        return selected?.type === "body"
          ? evidence.kind !== "aspect" && evidence.bodies.includes(selected.id)
          : selected?.type === "aspect"
            ? evidence.kind === "aspect" &&
              evidence.bodies[0] === selected.a &&
              evidence.bodies[1] === selected.b &&
              evidence.aspect === selected.kind
            : false;
      })
    : [];
  return (
    <div className="natal-layout" data-chart={chart ? "ready" : "entry"}>
      <section className="natal-stage-column">
        <Link href="/" prefetch={false}>
          ← Back to the room
        </Link>
        <div
          ref={stage}
          className="natal-stage"
          data-settled={sceneSettled}
          aria-busy={!sceneSettled}
          aria-label={chart ? "Crystal exploration area" : "Birthplace globe exploration area"}
        >
          <div className="natal-scene-caption">
            <p className="eyebrow">{!chart && birthplace.phase !== "room" ? "THE WORLD AT YOUR BEGINNING" : "THE CELESTIAL MIRROR"}</p>
            {!chart ? (
              <h1 tabIndex={-1}>
                {birthplace.phase === "room" ? <>A sky that<br /><em>began with you.</em></> : <>Find your <em>beginning.</em></>}
              </h1>
            ) : (
              <>
                <h1 tabIndex={-1}>Your celestial map</h1>
                <p>A symbolic longitude map, not planetary orbits.</p>
              </>
            )}
          </div>
        </div>
        {chart && (
          <p className="natal-stage-instruction">
            Select a marker or use the buttons. Escape or an empty area returns
            to the whole chart.
          </p>
        )}
      </section>
      <section
        ref={panel}
        className="panel natal-panel"
        aria-label={chart ? "Chart exploration and report" : "Birth details"}
      >
        {!chart ? (
          <>
            <p className="eyebrow">A PLACE. A MOMENT. YOU.</p>
            <h2>Where did your story begin?</h2>
            <p>Use the local date and time recorded at your birthplace.</p>
            <BirthForm
              preferAtlas={preferAtlas}
              initial={controller.initial}
              initialPlace={controller.initialPlace}
              busy={controller.busy}
              error={controller.error}
              onSubmit={controller.calculate}
            />
          </>
        ) : (
          <>
            <div className="panel-heading">
              <h2>
                {controller.initialPlace?.label ??
                  natal.place?.label ??
                  "Your birth chart"}
              </h2>
              <button onClick={controller.edit} disabled={controller.busy}>
                Edit details
              </button>
            </div>
            <HistoricalTime chart={chart} />
            {natal.facts?.certainty === "sampled" && (
              <p className="hint" role="status">
                Birth time is uncertain. Positions are representative midpoint
                samples; even a single observed sign is not a certified interval
                result. Ascendant, houses and aspects are omitted.
              </p>
            )}
            {natal.facts?.polar && (
              <p className="hint">
                At this latitude, Ascendant and houses are unavailable under the
                current engine policy.
              </p>
            )}
            <div className="actions">
              <button
                onClick={() => select(null)}
                aria-pressed={!natal.selection}
              >
                Whole chart
              </button>
              <button onClick={() => setFull((v) => !v)} aria-expanded={full}>
                {full ? "Back to exploration" : "Read full HTML report"}
              </button>
            </div>
            <div className="planets" aria-label="Select a celestial body">
              {chart.bodies.map((body) => (
                <button
                  key={body.id}
                  aria-pressed={
                    natal.selection?.type === "body" &&
                    natal.selection.id === body.id
                  }
                  onClick={() => select({ type: "body", id: body.id })}
                >
                  <strong>{titleCase(body.id)}</strong>
                  <span>
                    {degrees(body.longitude)}
                    {body.speed < 0 ? " ℞" : ""}
                  </span>
                </button>
              ))}
            </div>
            {chart.aspects.length > 0 && (
              <details>
                <summary>
                  Explore planetary relationships ({chart.aspects.length})
                </summary>
                <div className="aspect-controls">
                  {chart.aspects.map((a) => (
                    <button
                      key={`${a.a}.${a.b}.${a.kind}`}
                      aria-pressed={
                        natal.selection?.type === "aspect" &&
                        natal.selection.a === a.a &&
                        natal.selection.b === a.b &&
                        natal.selection.kind === a.kind
                      }
                      onClick={() =>
                        select({ type: "aspect", a: a.a, b: a.b, kind: a.kind })
                      }
                    >
                      {titleCase(a.a)} · {a.kind} · {titleCase(a.b)}
                      <small>Orb {a.orb.toFixed(2)}°</small>
                    </button>
                  ))}
                </div>
              </details>
            )}
            {natal.status === "loading" && (
              <p role="status">
                Composing your local interpretation… Your chart is ready to
                explore.
              </p>
            )}
            {natal.status === "error" && (
              <div role="alert">
                <p>
                  The interpretation could not be loaded or validated. The
                  calculated chart has been kept.
                </p>
                <button
                  onClick={
                    natal.error === "INVALID_SESSION"
                      ? controller.regenerate
                      : controller.retry
                  }
                >
                  {natal.error === "INVALID_SESSION"
                    ? "Generate a new interpretation with current content"
                    : "Retry interpretation for this chart"}
                </button>
              </div>
            )}
            {natal.status === "idle" && (
              <div className="hint">
                <p>
                  {natal.restored === "legacy"
                    ? "This legacy save contains the original chart, without the new report."
                    : "The saved interpretation uses unavailable versions."}{" "}
                  Generating a report uses current content and keeps the same
                  chart. Your saved copy changes only when you choose Save.
                </p>
                <button onClick={controller.retry}>
                  Generate interpretation
                </button>
              </div>
            )}
            {controller.content && natal.plan && natal.status === "ready" && (
              <>
                {!full && (
                  <>
                    {selectedItems.length ? (
                      <section aria-label="Selected chart detail">
                        {selectedItems.map((item) => (
                          <Placement
                            key={item.id}
                            item={item}
                            content={controller.content!}
                            onSelect={select}
                            open
                          />
                        ))}
                      </section>
                    ) : (
                      <section aria-label="Core interpretation">
                        <h3>A first look at your map</h3>
                        <h4>Your core map</h4>
                        {natal.plan.coreIds.map((id) => {
                          const item = natal.plan!.placements.find(
                            (p) => p.id === id,
                          )!;
                          return (
                            <p key={id}>
                              <button
                                onClick={() => select(itemSelection(item))}
                              >
                                Explore {evidenceLabel(item.evidence[0])}
                              </button>
                              <br />
                              {
                                controller.content!.articles[item.reference]
                                  .summary
                              }
                            </p>
                          );
                        })}
                        <h4>Themes in conversation</h4>
                        {natal.plan.themes.length ? (
                          natal.plan.themes.map((item) => (
                            <section key={item.id}>
                              <h4>
                                {
                                  controller.content!.articles[item.reference]
                                    .summary
                                }
                              </h4>
                              <p>
                                {
                                  controller.content!.articles[item.reference]
                                    .body
                                }
                              </p>
                              <p>
                                <strong>Try.</strong>{" "}
                                {
                                  controller.content!.articles[item.reference]
                                    .constructive
                                }
                              </p>
                              <p className="reflection">
                                {
                                  controller.content!.articles[item.reference]
                                    .question
                                }
                              </p>
                            </section>
                          ))
                        ) : (
                          <p>
                            {
                              controller.content.articles[
                                natal.facts?.certainty === "sampled"
                                  ? "overview.sampled"
                                  : "overview.no-pattern"
                              ].body
                            }
                          </p>
                        )}
                        <h4>Important relationships</h4>
                        {natal.plan.importantAspectIds.map((id) => {
                          const item = natal.plan!.aspects.find(
                            (p) => p.id === id,
                          )!;
                          return (
                            <p key={id}>
                              <button
                                onClick={() => select(itemSelection(item))}
                              >
                                Explore {evidenceLabel(item.evidence[0])}
                              </button>
                              <br />
                              {
                                controller.content!.articles[item.reference]
                                  .summary
                              }
                            </p>
                          );
                        })}
                        {!natal.plan.importantAspectIds.length && (
                          <p>
                            {
                              controller.content.articles["overview.no-aspects"]
                                .summary
                            }
                          </p>
                        )}
                        <h4>Life topics</h4>
                        {natal.plan.topics.map((topic) => (
                          <details key={topic.topic}>
                            <summary>
                              {
                                controller.content!.articles[topic.reference]
                                  .summary
                              }
                            </summary>
                            <p>
                              {
                                controller.content!.articles[topic.reference]
                                  .body
                              }
                            </p>
                            {topic.itemIds.map((id) => {
                              const item = [
                                ...natal.plan!.placements,
                                ...natal.plan!.aspects,
                              ].find((p) => p.id === id)!;
                              return (
                                <p key={id}>
                                  <button
                                    onClick={() => select(itemSelection(item))}
                                  >
                                    Explore {evidenceLabel(item.evidence[0])}
                                  </button>
                                  <br />
                                  {
                                    controller.content!.articles[item.reference]
                                      .summary
                                  }
                                </p>
                              );
                            })}
                          </details>
                        ))}
                        <button onClick={() => setFull(true)}>
                          Continue to the full report
                        </button>
                      </section>
                    )}
                  </>
                )}
                {full && (
                  <NatalReport
                    chart={chart}
                    plan={natal.plan}
                    content={controller.content}
                    onSelect={select}
                  />
                )}
              </>
            )}
            <div className="actions">
              <button
                disabled={natal.status !== "ready"}
                onClick={controller.save}
              >
                Save on this device
              </button>
              <button onClick={controller.remove}>Delete saved chart</button>
            </div>
          </>
        )}
        {controller.error && controller.error !== "NONEXISTENT_LOCAL_TIME" && (
          <ErrorNotice code={controller.error} />
        )}
        {controller.pending && (
          <div className="hint">
            <p>
              The saved birth details are available, but using them requires a
              new calculation with the current engine. The original save will
              remain unchanged until you Save.
            </p>
            <button
              onClick={controller.recalculateSaved}
              disabled={controller.busy}
            >
              Calculate saved details with current engine
            </button>
          </div>
        )}
        <button
          className="text-button"
          disabled={controller.busy}
          onClick={() => void controller.restore()}
        >
          Open saved chart
        </button>
        {controller.notice && <p role="status">{controller.notice}</p>}
        <small>
          Symbolic reflection, not prediction or a scientific personality
          assessment. No LLM or interpretation service is used.
        </small>
      </section>
    </div>
  );
}
