"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BirthInput } from "@pxoracle/contracts";
import type {
  AstrologySelection,
  AstrologyView,
} from "@pxoracle/contracts/astrology-view";
import { useOracle, useOracleStore } from "../state/store";
import {
  birthInputFrom,
  consultationFromInput,
  emptyDraft,
  type ConfirmedBirthplace,
  type ConsultationIntent,
} from "../state/consultation";
import { ErrorNotice } from "./shared";
import { BirthDetailsForm, BirthplaceForm } from "./astrology/BirthForm";
import { useNatal, type NatalEngine } from "./astrology/useNatal";
import { probeSaved } from "./astrology/savedProbe";
import type { RestoreCandidate } from "./astrology/persistence";
import {
  BirthReview,
  HoroscopesBubble,
  HubBubble,
  NatalHelp,
  NatalGreeting,
  OracleBubble,
} from "./astrology/Consultation";
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
  const birthplace = useOracle((s) => s.birthplace);
  const consultation = useOracle((s) => s.consultation);
  const store = useOracleStore();
  const controller = useNatal(engine);
  const dispatch = useCallback(
    (intent: ConsultationIntent) => store.getState().navigateConsultation(intent),
    [store],
  );
  const { presentation, stage } = consultation;
  // Static HTML renders the hub before hydration; controls enable once React owns them.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const busy = controller.busy || !hydrated;
  const unhydrated = !hydrated;
  const inCrystal = presentation === "crystal" && !!chart;
  // Camera presentation is explicit navigation; a chart alone never selects the crystal.
  const view: "crystal" | "globe" | "table" = inCrystal ? "crystal" : presentation === "globe" ? "globe" : "table";

  // Route entry: an explicit globe shortcut keeps its context; everything else begins at the table.
  useEffect(() => {
    const s = store.getState();
    if (s.globeEntryPending) s.consumeGlobeEntry();
    else s.navigateConsultation({ type: "arrive" });
  }, [store]);

  // Hydration-safe saved-data probe: read-only, repeated after explicit Save/Delete.
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  useEffect(() => {
    const probe = probeSaved(() => localStorage);
    setCandidate(probe.candidate);
    store.getState().navigateConsultation({ type: "saved", availability: probe.availability });
  }, [store, controller.storageRevision]);

  const [full, setFull] = useState(false);
  const [sceneSettled, setSceneSettled] = useState(false);
  const cameraRequest = useRef(0);
  const onSettled = useCallback((revision: number) => {
    if (revision === cameraRequest.current) setSceneSettled(true);
  }, []);
  const stageElement = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [natal.revision, view, stage]);
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
  // Keyboard focus follows the dialogue after each explicit stage or presentation change.
  const focusedRevision = useRef(consultation.revision);
  useEffect(() => {
    if (focusedRevision.current === consultation.revision) return;
    focusedRevision.current = consultation.revision;
    const target =
      column.current?.querySelector<HTMLElement>(".oracle-bubble") ??
      panel.current?.querySelector<HTMLElement>("h2[tabindex], .stage-return");
    target?.focus({ preventScroll: true });
  }, [consultation.revision]);
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
      const rect = stageElement.current?.getBoundingClientRect();
      if (!rect) return;
      const w = window.innerWidth,
        h = window.innerHeight;
      const left = Math.max(0, rect.left);
      let top = Math.max(0, rect.top),
        bottom = rect.bottom;
      // On phones the oracle is framed between the caption above and the bubble below, never behind them.
      if (w <= 800 && view === "table") {
        const caption = stageElement.current?.querySelector(".natal-scene-caption");
        if (caption) top = Math.max(top, caption.getBoundingClientRect().bottom);
        const bubble = column.current?.querySelector<HTMLElement>(".oracle-bubble");
        if (bubble && getComputedStyle(bubble).position === "absolute")
          bottom = Math.min(bottom, bubble.getBoundingClientRect().top);
      }
      const next = {
        left: left / w,
        top: top / h,
        width: Math.max(1, Math.min(w, rect.right) - left) / w,
        height: Math.max(1, Math.min(h, bottom) - top) / h,
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
    if (stageElement.current) observer.observe(stageElement.current);
    const framing = [
      stageElement.current?.querySelector(".natal-scene-caption"),
      column.current?.querySelector(".oracle-bubble"),
    ];
    for (const element of framing) if (element) observer.observe(element);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [view, stage]);
  useEffect(() => {
    setSceneSettled(false);
    const revision = ++cameraRequest.current;
    store.getState().setAstrologyView({
      phase: inCrystal ? "chart" : "entry",
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
    inCrystal,
    natal.revision,
    natal.selection,
    viewport,
    select,
    onSettled,
    store,
  ]);
  // Globe phases follow the presentation: the table framing is "room", the crystal hides browsing.
  const globePhase =
    view === "globe"
      ? birthplace.phase === "room"
        ? "overview"
        : birthplace.phase
      : view === "crystal"
        ? "crystal"
        : "room";
  useEffect(() => {
    store.getState().setGlobeView({
      phase: globePhase,
      region: birthplace.region, country: birthplace.country, revision: birthplace.revision, adjustment: birthplace.adjustment, viewport,
      onIntent: store.getState().navigateBirthplace,
    });
  }, [globePhase, birthplace.region, birthplace.country, birthplace.revision, birthplace.adjustment, viewport, store]);
  useEffect(() => () => { store.getState().setAstrologyView(undefined); store.getState().setGlobeView(undefined); }, [store]);
  // Layered Escape: report → exploration → whole chart → table; globe → table. One handler.
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const s = store.getState();
      if (s.consultation.presentation === "crystal" && s.chart) {
        if (full) setFull(false);
        else if (s.natal.selection) select(null);
        else s.navigateConsultation({ type: "return" });
      } else if (s.consultation.presentation === "globe") s.navigateBirthplace({ type: "cancel" });
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [select, store, full]);
  useEffect(() => {
    if (!inCrystal) setFull(false);
  }, [inCrystal]);

  const draft = consultation.draft ?? emptyDraft();
  const confirmed = consultation.birthplace;
  const hasDraft = !!(confirmed || consultation.draft);
  const actions = {
    natal: () => dispatch({ type: "service", service: "natal" }),
    horoscopes: () => dispatch({ type: "service", service: "horoscopes" }),
    hub: () => dispatch({ type: "hub" }),
    returnToTable: () => dispatch({ type: "return" }),
    resumeChart: () => dispatch({ type: "open-crystal" }),
    continueDraft: () => dispatch({ type: "details" }),
    exploreBirthplace: () => store.getState().navigateBirthplace({ type: "open" }),
    newChart: () => {
      controller.clearError();
      dispatch({ type: "new-chart" });
      store.getState().navigateBirthplace({ type: "open" });
    },
    confirmBirthplace: (place: ConfirmedBirthplace) => {
      dispatch({ type: "confirm-birthplace", birthplace: place });
      store.getState().navigateBirthplace({ type: "cancel" });
    },
    cancelBirthplace: () => store.getState().navigateBirthplace({ type: "cancel" }),
    review: () => {
      controller.clearError();
      dispatch({ type: "review" });
    },
    editDetails: () => dispatch({ type: "details" }),
    useSaved: () => {
      if (!candidate) return;
      controller.clearError();
      dispatch({ type: "use-saved", ...consultationFromInput(candidate.input, candidate.place) });
    },
    adjustDetails: () => {
      if (!chart) return;
      controller.clearError();
      dispatch({ type: "use-saved", stage: "details", ...consultationFromInput(chart.provenance.settings as BirthInput, natal.place) });
    },
    openSaved: async () => {
      const revision = store.getState().consultation.revision;
      const ok = await controller.restore();
      // A late completion updates data only; it cannot pull a reader who moved on into the crystal.
      if (ok && store.getState().consultation.revision === revision) dispatch({ type: "open-crystal" });
    },
    calculate: async (fold: BirthInput["fold"]) => {
      const input = birthInputFrom(confirmed, consultation.draft, fold);
      if (!input || !confirmed) return;
      const revision = store.getState().consultation.revision;
      const ok = await controller.calculate(input, confirmed.provenance);
      if (ok && store.getState().consultation.revision === revision) dispatch({ type: "open-crystal" });
    },
    deleteSaved: () => controller.remove(),
  };

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
  // The oracle's bubble carries the choices and greetings; the panel is only for forms, the globe and the chart.
  const hasPanel = !(view === "table" && (stage === "hub" || stage === "horoscopes" || stage === "greeting"));
  const bubble =
    view !== "table" ? null : stage === "hub" ? (
      <HubBubble
        hasChart={!!chart}
        hasDraft={hasDraft}
        disabled={busy}
        onNatal={actions.natal}
        onHoroscopes={actions.horoscopes}
        onResumeChart={actions.resumeChart}
        onContinueDraft={actions.continueDraft}
      />
    ) : stage === "horoscopes" ? (
      <HoroscopesBubble disabled={busy} onBack={actions.hub} onNatal={actions.natal} />
    ) : stage === "greeting" ? (
      <NatalGreeting
        saved={consultation.saved}
        label={candidate?.place?.label ?? null}
        date={candidate?.input.date ?? null}
        hasChart={!!chart}
        hasDraft={hasDraft}
        busy={controller.busy}
        disabled={unhydrated}
        actions={{
          openSaved: () => void actions.openSaved(),
          useSaved: actions.useSaved,
          newChart: actions.newChart,
          resumeChart: actions.resumeChart,
          continueDraft: actions.continueDraft,
          deleteSaved: actions.deleteSaved,
          back: actions.hub,
        }}
      />
    ) : stage === "details" ? (
      <OracleBubble stage="details">Born in {confirmed?.label ?? "your birthplace"}. Now tell me the date, and the time if you know it.</OracleBubble>
    ) : (
      <OracleBubble stage="review">Let me read that back before I look into the crystal.</OracleBubble>
    );
  return (
    <div
      className="natal-layout"
      data-chart={inCrystal ? "ready" : "entry"}
      data-presentation={view}
      data-stage={stage}
      data-globe-phase={globePhase}
      data-panel={hasPanel ? "open" : "none"}
    >
      <section className="natal-stage-column" ref={column}>
        <Link href="/" prefetch={false}>
          ← Back to the room
        </Link>
        <div
          ref={stageElement}
          className="natal-stage"
          data-settled={sceneSettled}
          aria-busy={!sceneSettled}
          aria-label={view === "crystal" ? "Crystal exploration area" : view === "globe" ? "Birthplace globe exploration area" : "Consultation table"}
        >
          <div className="natal-scene-caption">
            <p className="eyebrow">{view === "globe" ? "THE WORLD AT YOUR BEGINNING" : view === "crystal" ? "THE CELESTIAL MIRROR" : "THE ORACLE’S STUDY"}</p>
            {view === "crystal" ? (
              <>
                <h1 tabIndex={-1}>Your celestial map</h1>
                <p>A symbolic longitude map, not planetary orbits.</p>
              </>
            ) : (
              <h1 tabIndex={-1}>
                {view === "globe" ? <>Find your <em>beginning.</em></> : <>A sky that<br /><em>began with you.</em></>}
              </h1>
            )}
          </div>
          {view === "table" && (stage === "greeting" || stage === "details" || stage === "review") && <NatalHelp />}
          {view !== "table" && (
            <button type="button" className="stage-return" onClick={view === "globe" ? actions.cancelBirthplace : actions.returnToTable}>
              ← Return to the table
            </button>
          )}
        </div>
        {bubble}
        {view === "crystal" && (
          <p className="natal-stage-instruction">
            Select a marker or use the buttons. Escape or an empty area returns
            to the whole chart, then to the table.
          </p>
        )}
      </section>
      {hasPanel && (
      <section
        ref={panel}
        className="panel natal-panel"
        aria-label={view === "crystal" ? "Chart exploration and report" : view === "globe" ? "Birthplace" : "Consultation"}
      >
        {view === "globe" && (
          <>
            <p className="eyebrow">A PLACE. A MOMENT. YOU.</p>
            <h2 tabIndex={-1}>Where did your story begin?</h2>
            <BirthplaceForm confirmed={confirmed} onConfirm={actions.confirmBirthplace} onCancel={actions.cancelBirthplace} />
          </>
        )}
        {view === "table" && stage === "details" && confirmed && (
          <>
            <p className="eyebrow">A PLACE. A MOMENT. YOU.</p>
            <h2 tabIndex={-1}>When were you born?</h2>
            <p className="place-confirmation" role="status">
              <strong>{confirmed.label}</strong>
              <br />
              {confirmed.latitude}°, {confirmed.longitude}° · {confirmed.timezone}
            </p>
            <BirthDetailsForm draft={draft} onChange={(value) => dispatch({ type: "draft", draft: value })} onContinue={actions.review} />
            <div className="actions">
              <button type="button" disabled={unhydrated} onClick={actions.exploreBirthplace}>Change birthplace</button>
              <button type="button" disabled={unhydrated} onClick={actions.hub}>Back to the consultation</button>
            </div>
          </>
        )}
        {view === "table" && stage === "review" && confirmed && (
          <BirthReview
            birthplace={confirmed}
            draft={draft}
            busy={controller.busy}
            disabled={unhydrated}
            error={controller.error}
            onCalculate={(fold) => void actions.calculate(fold)}
            onEditDetails={actions.editDetails}
            onChangeBirthplace={actions.exploreBirthplace}
            onBack={actions.hub}
          />
        )}
        {view === "table" && (stage === "details" || stage === "review") && !confirmed && (
          <div className="hint">
            <p>No birthplace is confirmed yet.</p>
            <button type="button" onClick={actions.exploreBirthplace}>Choose a birthplace</button>
          </div>
        )}
        {view === "crystal" && chart && (
          <>
            <div className="panel-heading">
              <h2 tabIndex={-1}>{natal.place?.label ?? "Your birth chart"}</h2>
              <button onClick={actions.returnToTable}>Return to the table</button>
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
              <button onClick={actions.adjustDetails} disabled={controller.busy}>
                Adjust birth details
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
              <button onClick={actions.returnToTable}>Return to the table</button>
            </div>
          </>
        )}
        {controller.error && !["NONEXISTENT_LOCAL_TIME", "AMBIGUOUS_LOCAL_TIME"].includes(controller.error) && (
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
        {controller.notice && <p role="status">{controller.notice}</p>}
        <small>
          Symbolic reflection, not prediction or a scientific personality
          assessment. No LLM or interpretation service is used.
        </small>
      </section>
      )}
    </div>
  );
}
