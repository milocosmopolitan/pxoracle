"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ArtManifest,
  TarotContent,
  TarotSession,
} from "@pxoracle/contracts";
import { useOracle } from "../state/store";
import { ErrorNotice, Loading, saveReading, readReading } from "./shared";
type Engine = typeof import("@pxoracle/engine-client/tarot");
export default function Tarot({
  engine: providedEngine,
}: { engine?: Engine } = {}) {
  const session = useOracle((s) => s.tarot),
    setSession = useOracle((s) => s.setTarot),
    question = useOracle((s) => s.question),
    setQuestion = useOracle((s) => s.setQuestion);
  const [spread, setSpread] = useState<1 | 3>(3),
    [reversals, setReversals] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [art, setArt] = useState<ArtManifest | null>(null),
    [content, setContent] = useState<TarotContent | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  useEffect(()=>()=>{++generation.current;},[]);
  async function loadContent() {
    const [a, c] = await Promise.all([
      fetch("/art/manifest.json"),
      fetch("/content/tarot.en.v1.json"),
    ]);
    if (!a.ok || !c.ok) throw new Error("CONTENT_LOAD_FAILED");
    const manifest: ArtManifest = await a.json(),
      pack: TarotContent = await c.json();
    if (
      manifest.schemaVersion !== 1 ||
      pack.version !== "en.v1" ||
      Object.keys(manifest.cards).length !== 78
    )
      throw new Error("INCOMPATIBLE_SESSION");
    setArt(manifest);
    setContent(pack);
  }
  useEffect(() => {
    let active = true;
    void loadContent().catch(() => {
      if (active) setError("CONTENT_LOAD_FAILED");
    });
    return () => {
      active = false;
    };
  }, []);
  async function action(fn: (engine: Engine) => Promise<TarotSession>) {
    if (locked.current) return;
    locked.current = true;
    const id=++generation.current;
    setBusy(true);
    setError("");
    try {
      const engine =
        providedEngine ?? (await import("@pxoracle/engine-client/tarot"));
      const result=await fn(engine);
      if(id===generation.current)setSession(result);
    } catch (e) {
      if(id===generation.current)setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      if(id===generation.current){locked.current = false;
      setBusy(false); }
    }
  }
  const allRevealed =
    session?.state === "reading" || session?.state === "completed";
  return (
    <div className="tarot-layout">
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
              A question, if you have one
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1000}
                placeholder="What deserves my attention right now?"
              />
              <small>
                Your question stays in memory and is not included in saved
                readings.
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
            <button
              className="primary"
              disabled={busy || !art || !content}
              onClick={() => void action((e) => e.create(spread, reversals))}
            >
              Shuffle the deck →
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                try {
                  const s = readReading("tarot");
                  if (s) void action((e) => e.restore(s));
                  else setNotice("No saved reading on this device.");
                } catch {
                  setError("INCOMPATIBLE_SESSION");
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
                <p className="eyebrow">
                  {allRevealed ? "YOUR READING" : "TRUST YOUR CURIOSITY"}
                </p>
                <h2>
                  {allRevealed
                    ? "Let the images settle."
                    : `Choose ${session.spread === 1 ? "one card" : "three cards"}.`}
                </h2>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  setSession(null);
                  setNotice("");
                }}
              >
                New reading
              </button>
            </div>
            {question && <p className="question">“{question}”</p>}
            <div
              className="spread"
              style={{
                gridTemplateColumns: `repeat(${session.spread},minmax(0,1fr))`,
              }}
            >
              {Array.from({ length: session.spread }, (_, i) => {
                const picked = session.selections[i];
                const details = picked && content?.cards[picked.card.cardId];
                const asset = picked && art?.cards[picked.card.cardId];
                return (
                  <article className="spread-card" key={i}>
                    <p className="eyebrow">
                      {session.spread === 1
                        ? "Focus"
                        : ["Situation", "Examination", "Next action"][i]}
                    </p>
                    {picked ? (
                      <>
                        <button
                          className={`card-face ${picked.revealed ? "revealed" : ""}`}
                          disabled={busy || picked.revealed}
                          aria-label={
                            picked.revealed
                              ? details?.name
                              : `Reveal card ${i + 1}`
                          }
                          onClick={() =>
                            void action((e) => e.reveal(session, i))
                          }
                        >
                          {picked.revealed && asset ? (
                            <img
                              src={asset.url}
                              alt={asset.name}
                              style={{
                                transform:
                                  picked.card.orientation === "reversed"
                                    ? "rotate(180deg)"
                                    : undefined,
                              }}
                            />
                          ) : (
                            <span className="card-back">
                              ✧<small>Reveal</small>
                            </span>
                          )}
                        </button>
                        {picked.revealed && (
                          <>
                            <h3>{details?.name}</h3>
                            <small className="orientation">
                              {picked.card.orientation}
                            </small>
                            <p>{details?.[picked.card.orientation]}</p>
                            <p className="prompt">
                              {content?.positions[picked.positionId]}
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="empty-card">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <small>Choose from the deck</small>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {session.selections.length < session.spread && (
              <>
                <p className="deck-instruction">
                  {session.selections.length} of {session.spread} selected ·
                  78-card deck
                </p>
                <div className="card-fan" aria-label="Choose a face-down slot">
                  {Array.from({ length: 78 }, (_, slot) => (
                    <button
                      key={slot}
                      disabled={
                        busy || session.selections.some((x) => x.slot === slot)
                      }
                      aria-label={`Choose slot ${slot + 1}`}
                      onClick={() =>
                        void action((e) => e.select(session, slot))
                      }
                    >
                      <span>✧</span>
                      <small>{slot + 1}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {allRevealed && (
              <aside className="synthesis">
                <p className="eyebrow">BRINGING IT TOGETHER</p>
                <p>
                  Notice how{" "}
                  {session.selections
                    .map((s) => content?.cards[s.card.cardId]?.theme)
                    .filter(Boolean)
                    .join(", ")}{" "}
                  meet in your question. Which image feels most useful, and what
                  is one small step you can take from it?
                </p>
              </aside>
            )}
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  try {
                    saveReading("tarot", session);
                    setNotice(
                      "Reading saved on this device. Your question was not saved.",
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
                    localStorage.removeItem("pxoracle.tarot.v1");
                    setNotice("Saved reading deleted.");
                  } catch {
                    setNotice("Storage is unavailable.");
                  }
                }}
              >
                Delete saved reading
              </button>
              {session.state === "reading" && (
                <button onClick={() => void action((e) => e.complete(session))}>
                  Complete reading
                </button>
              )}
            </div>
          </>
        )}
        {busy && <Loading />}
        {error && (
          <ErrorNotice
            code={error}
            retry={
              error === "CONTENT_LOAD_FAILED"
                ? () =>
                    void loadContent()
                      .then(() => setError(""))
                      .catch(() => setError("CONTENT_LOAD_FAILED"))
                : undefined
            }
          />
        )}
        <p role="status">{notice}</p>
      </section>
    </div>
  );
}
