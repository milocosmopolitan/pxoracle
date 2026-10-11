"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ArtManifest, TarotContent } from "@pxoracle/contracts";
import { useOracle, useOracleStore } from "../state/store";
import { ErrorNotice } from "./shared";
import {
  TarotController,
  tarotView,
  type TarotEngine,
} from "./tarot/controller";
import type { Context } from "@pxoracle/contracts/reading";
import {
  PerspectiveFields,
  ReadingResult,
  ReadingFailure,
  LegacyPerspective,
  UnsupportedReading,
} from "./tarot/ReadingResult";
import { useReading } from "./tarot/useReading";
import {
  READING_VERSIONS,
  TOPICS,
  INTENTS,
  currentVersions,
} from "./tarot/reading";
import {
  readSavedTarot,
  saveTarot,
  deleteTarot,
  type SavedTarot,
} from "./tarot/persistence";
const labels: Record<string, string> = {
  conversation: "Before we begin",
  approach: "Coming closer to the table…",
  shuffle: "Shuffling the deck…",
  fan: "Laying out the cards…",
  selecting: "Choose a card from the table",
  dealing: "Placing your chosen card…",
  preparing: "Preparing the same selected card…",
  revealing: "Turning your card…",
  reading: "Your reading",
};
export default function Tarot({
  engine: providedEngine,
}: {
  engine?: TarotEngine & {
    interpret?: typeof import("@pxoracle/engine-client/tarot").interpret;
  };
} = {}) {
  const store = useOracleStore();
  const interpretation = useReading(
    providedEngine ? (providedEngine.interpret ?? false) : undefined,
  );
  const [perspective, setPerspective] = useState<Context>({
    topic: "relationships",
    intent: "present",
  });
  const session = useOracle((s) => s.tarot),
    p = useOracle((s) => s.tarotPresentation),
    question = useOracle((s) => s.question),
    setQuestion = useOracle((s) => s.setQuestion);
  const [pendingRestore, setPendingRestore] = useState<SavedTarot | null>(null);
  const [controller, setController] = useState<TarotController | null>(null);
  const [spread, setSpread] = useState<1 | 3>(3),
    [reversals, setReversals] = useState(false),
    [notice, setNotice] = useState("");
  const [art, setArt] = useState<ArtManifest | null>(null),
    [content, setContent] = useState<TarotContent | null>(null),
    [contentError, setContentError] = useState(false),
    [contentAttempt, setContentAttempt] = useState(0);
  useEffect(() => {
    const c = new TarotController(
      {
        get: store.getState,
        session: (s) => store.getState().setTarot(s),
        presentation: (v) => store.getState().setTarotPresentation(v),
      },
      () =>
        providedEngine
          ? Promise.resolve(providedEngine)
          : import("@pxoracle/engine-client/tarot"),
    );
    c.resume();
    setController(c);
    return () => {
      c.dispose();
      store.getState().setTarotView(undefined);
    };
  }, [store, providedEngine]);
  useEffect(() => {
    const abort = new AbortController();
    setContentError(false);
    void Promise.all([
      fetch("/art/manifest.json", { signal: abort.signal }),
      fetch("/content/tarot.en.v1.json", { signal: abort.signal }),
    ])
      .then(async ([a, c]) => {
        if (!a.ok || !c.ok) throw new Error("content");
        const manifest = (await a.json()) as ArtManifest,
          pack = (await c.json()) as TarotContent;
        if (
          manifest.schemaVersion !== 1 ||
          pack.version !== "en.v1" ||
          Object.keys(manifest.cards).length !== 78
        )
          throw new Error("content");
        if (!abort.signal.aborted) {
          setArt(manifest);
          setContent(pack);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setContentError(true);
      });
    return () => abort.abort();
  }, [contentAttempt]);
  const view = useMemo(
    () => ({
      ...tarotView(session, p, art),
      readingPanel: true,
      readingFocus: p.readingFocus ?? null,
      onIntent: (e: { type: "select" | "focus" | "inspect"; slot: number }) => {
        if (e.type === "select") void controller?.select(e.slot);
        else if (e.type === "focus") controller?.focus(e.slot);
        else {
          const index =
            session?.selections.findIndex((card) => card.slot === e.slot) ?? -1;
          if (index >= 0)
            store.getState().setTarotPresentation({ readingFocus: index });
        }
      },
      onEvent: (e: Parameters<TarotController["event"]>[0]) => {
        void controller?.event(e);
      },
    }),
    [session, p, art, controller],
  );
  useEffect(() => {
    store.getState().setTarotView(view);
  }, [view, store]);
  useEffect(() => {
    if (p.phase === "selecting" && document.activeElement === document.body)
      document
        .querySelector<HTMLButtonElement>(
          ".slot-controls button:not(:disabled)",
        )
        ?.focus({ preventScroll: true });
  }, [p.phase]);
  useEffect(() => {
    // The form button may have scrolled the page. Keep the fixed table visible during choreography.
    if (["approach", "dealing", "revealing"].includes(p.phase))
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [p.phase]);
  const startReading = () => {
    setPendingRestore(null);
    store
      .getState()
      .setReading({
        context: spread === 3 ? perspective : null,
        versions: spread === 3 ? READING_VERSIONS : null,
        plan: null,
        status: "idle",
        error: "",
      });
    void controller?.start(spread, reversals);
  };
  const active = !!session,
    selecting = p.phase === "selecting",
    reading = p.phase === "reading";
  return (
    <div
      data-phase={p.phase}
      className={`tarot-layout ${active ? "table-reading" : ""}`}
    >
      <div className="tarot-heading">
        <Link href="/" prefetch={false}>
          ← Back to the room
        </Link>
        <p className="eyebrow">A CONVERSATION WITH THE CARDS</p>
        <h1 tabIndex={-1}>
          Make a little room
          <br />
          <em>for possibility.</em>
        </h1>
        <p>Not a fixed future. A different way to look at the present.</p>
      </div>
      <section className="panel tarot-panel">
        {!session ? (
          <>
            <p className="eyebrow">BEFORE WE BEGIN</p>
            <h2>What’s on your mind?</h2>
            <label>
              A private note, if you wish
              <textarea
                maxLength={1000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What deserves my attention right now?"
              />
              <small>
                This note is not analyzed. It stays in memory and is never saved
                or sent.
              </small>
            </label>
            <div className="two">
              <label>
                Your spread
                <select
                  value={spread}
                  onChange={(e) => setSpread(Number(e.target.value) as 1 | 3)}
                >
                  <option value="1">One card · A moment of focus</option>
                  <option value="3">Three cards · A wider perspective</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={reversals}
                  onChange={(e) => setReversals(e.target.checked)}
                />
                Include reversed cards
              </label>
            </div>
            {spread === 3 && (
              <PerspectiveFields
                value={perspective}
                onChange={setPerspective}
              />
            )}
            <button
              className="primary"
              disabled={p.busy || !art || !content || !controller}
              onClick={startReading}
            >
              Shuffle the deck →
            </button>
            <button
              className="text-button"
              disabled={p.busy || !controller}
              onClick={() => {
                try {
                  setPendingRestore(null);
                  store.getState().setTarotPresentation({ error: "" });
                  const saved = readSavedTarot(localStorage);
                  if (saved) {
                    setPendingRestore(saved);
                    store.getState().setReading({
                      context: saved.perspective,
                      versions: saved.readingVersions,
                      plan: null,
                      status: "idle",
                      error: "",
                    });
                    void controller?.restore(saved.draw);
                  } else setNotice("No saved reading on this device.");
                } catch {
                  setNotice("The saved reading could not be read.");
                }
              }}
            >
              Resume a saved reading
            </button>
          </>
        ) : (
          <>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{labels[p.phase]}</p>
                <h2>
                  {reading
                    ? "Let the images settle."
                    : `${session.selections.length} of ${session.spread} cards selected`}
                </h2>
              </div>
            </div>
            <p role="status" aria-live="polite">
              {p.busy ? "Confirming your choice…" : labels[p.phase]}
            </p>
            {session.spread === 3 && interpretation.context && (
              <p>
                {TOPICS[interpretation.context.topic]} ·{" "}
                {INTENTS[interpretation.context.intent]}
                <small> · Fixed for this reading</small>
              </p>
            )}
            {session.spread === 3 && !interpretation.context && (
              <LegacyPerspective
                value={perspective}
                onChange={setPerspective}
                onConfirm={() =>
                  store
                    .getState()
                    .setReading({
                      context: perspective,
                      versions: READING_VERSIONS,
                    })
                }
              />
            )}
            {session.spread === 3 &&
              interpretation.versions &&
              !currentVersions(interpretation.versions) && (
                <UnsupportedReading
                  onConfirm={() => {
                    store
                      .getState()
                      .setReading({ versions: READING_VERSIONS, plan: null });
                    setNotice(
                      "Reinterpreted with current content. Save explicitly to replace the saved version.",
                    );
                  }}
                />
              )}
            {selecting && (
              <>
                <p>
                  Touch a card on the mat, or use these numbered controls. Focus
                  highlights the same card.
                </p>
                <div
                  className="slot-controls"
                  aria-label="Choose a face-down slot"
                >
                  {Array.from(
                    { length: Math.min(12, 78 - p.page * 12) },
                    (_, n) => {
                      const slot = p.page * 12 + n,
                        used = session.selections.some((x) => x.slot === slot);
                      return (
                        <button
                          key={slot}
                          disabled={p.busy || used}
                          aria-label={`Choose slot ${slot + 1}`}
                          aria-pressed={p.focus === slot}
                          onFocus={() => controller?.focus(slot)}
                          onClick={() => void controller?.select(slot)}
                        >
                          {slot + 1}
                          {used ? " ✓" : ""}
                        </button>
                      );
                    },
                  )}
                </div>
                <div className="actions">
                  <button
                    disabled={p.page === 0 || p.busy}
                    onClick={() => controller?.page(store.getState().tarotPresentation.page - 1)}
                  >
                    Previous cards
                  </button>
                  <span>{p.page + 1} / 7</span>
                  <button
                    disabled={p.page === 6 || p.busy}
                    onClick={() => controller?.page(store.getState().tarotPresentation.page + 1)}
                  >
                    Next cards
                  </button>
                </div>
                {!session.selections.length && (
                  <button
                    disabled={p.busy}
                    onClick={() =>
                      void controller?.start(session.spread, reversals)
                    }
                  >
                    Shuffle again
                  </button>
                )}
              </>
            )}
            {p.error === "CARD_ART_FAILED" && (
              <div role="alert" className="error">
                <p>
                  The selected card image could not load. Your draw is
                  unchanged.
                </p>
                <button onClick={() => controller?.retryArt()}>
                  Retry same card
                </button>
              </div>
            )}
            {!reading && !selecting && (
              <details className="motion-controls">
                <summary>Animation or graphics unavailable?</summary>
                <button
                  disabled={p.busy}
                  onClick={() =>
                    void controller?.event({
                      type: p.phase === "preparing" ? "ready" : "done",
                      revision: p.revision,
                    })
                  }
                >
                  Continue with text reading
                </button>
              </details>
            )}
            {reading && (
              <>
                <p>Choose an open card on the table to look closer.</p>
                <div className="actions" aria-label="Reading camera">
                  <button
                    aria-pressed={p.readingFocus == null}
                    onClick={() =>
                      store
                        .getState()
                        .setTarotPresentation({ readingFocus: null })
                    }
                  >
                    Show all cards
                  </button>
                  {session.selections.map((_, i) => (
                    <button
                      key={i}
                      aria-pressed={p.readingFocus === i}
                      onClick={() =>
                        store
                          .getState()
                          .setTarotPresentation({ readingFocus: i })
                      }
                    >
                      Look closer at card {i + 1}
                    </button>
                  ))}
                </div>
                {session.spread === 3 ? (
                  <>
                    {interpretation.status === "loading" && (
                      <p role="status">Assembling your reflection…</p>
                    )}
                    {interpretation.status === "error" && (
                      <ReadingFailure retry={interpretation.retry} />
                    )}
                    {interpretation.plan && interpretation.pack && (
                      <ReadingResult
                        plan={interpretation.plan}
                        pack={interpretation.pack}
                        focus={p.readingFocus ?? null}
                        onFocus={(index) =>
                          store
                            .getState()
                            .setTarotPresentation({ readingFocus: index })
                        }
                      />
                    )}
                  </>
                ) : (
                  <details open className="reading-details">
                    <summary>Card meanings and reflection</summary>
                    {question && <p className="question">“{question}”</p>}
                    <p className="reading-disclosure">
                      These are card-based reflection prompts. Your question is
                      not analyzed.
                    </p>
                    {session.selections.map((selected, i) => {
                      const detail = content?.cards[selected.card.cardId];
                      return (
                        <article className="reading-card" key={selected.slot}>
                          <p className="eyebrow">
                            {i + 1} · {selected.positionId.replace("_", " ")}
                          </p>
                          <h3>{detail?.name ?? selected.card.cardId}</h3>
                          <small>{selected.card.orientation}</small>
                          <p>{detail?.[selected.card.orientation]}</p>
                          <p className="prompt">
                            {content?.positions[selected.positionId]}
                          </p>
                        </article>
                      );
                    })}
                    <aside className="synthesis">
                      <p className="eyebrow">BRINGING IT TOGETHER</p>
                      {session.selections.map((s) => (
                        <p key={s.slot}>
                          <strong>{s.positionId.replace("_", " ")}: </strong>
                          {content?.cards[s.card.cardId]?.theme} through{" "}
                          {content?.cards[s.card.cardId]?.name} (
                          {s.card.orientation}).
                        </p>
                      ))}
                      <p>
                        Choose one detail in this card that you can turn into a
                        small action today. Return later to notice what changed.
                      </p>
                    </aside>
                  </details>
                )}
              </>
            )}
            <div className="actions">
              <button
                disabled={p.busy}
                onClick={() => {
                  store.getState().setTarotPresentation({ readingFocus: null });
                  controller?.reset();
                  setPendingRestore(null);
                  setQuestion("");
                  setNotice("");
                }}
              >
                New reading
              </button>
              <button
                disabled={p.busy}
                onClick={() => {
                  try {
                    saveTarot(
                      localStorage,
                      session,
                      interpretation.context,
                      interpretation.versions,
                    );
                    setNotice(
                      "Reading saved on this device. Your private note was not saved.",
                    );
                  } catch {
                    setNotice("This browser could not save the reading.");
                  }
                }}
              >
                Save reading
              </button>
              <button
                onClick={() => {
                  try {
                    deleteTarot(localStorage);
                    setNotice("Saved reading deleted.");
                  } catch {
                    setNotice("Storage is unavailable.");
                  }
                }}
              >
                Delete saved reading
              </button>
              {session.state === "reading" && reading && (
                <button
                  disabled={p.busy}
                  onClick={() => void controller?.complete()}
                >
                  Complete reading
                </button>
              )}
            </div>
          </>
        )}
        {p.error && p.error !== "CARD_ART_FAILED" && (
          <ErrorNotice
            code={p.error}
            retry={() =>
              session
                ? controller?.retryArt()
                : pendingRestore
                  ? void controller?.restore(pendingRestore.draw)
                  : startReading()
            }
          />
        )}
        {contentError && (
          <ErrorNotice
            code="CONTENT_LOAD_FAILED"
            retry={() => setContentAttempt((n) => n + 1)}
          />
        )}
        <p role="status">{notice}</p>
      </section>
    </div>
  );
}
