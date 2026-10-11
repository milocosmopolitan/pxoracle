import { useEffect, useState } from "react";
import { useOracle, useOracleStore } from "../../state/store";
import {
  readingInput,
  loadProse,
  validateReferences,
  type ProsePack,
} from "./reading";
type Interpret = typeof import("@pxoracle/engine-client/tarot").interpret;
export function useReading(providedInterpret?: Interpret | false) {
  const store = useOracleStore();
  const session = useOracle((s) => s.tarot),
    state = useOracle((s) => s.reading);
  const [pack, setPack] = useState<ProsePack | null>(null),
    [attempt, setAttempt] = useState(0);
  const eligible =
    session?.spread === 3 &&
    session.selections.length === 3 &&
    session.selections.every((c) => c.revealed);
  // A completed draw changes state, not its interpretation. Never send hidden selections or notes.
  const fingerprint = eligible
    ? JSON.stringify(
        session.selections.map((c) => [
          c.card.cardId,
          c.card.orientation,
          c.positionId,
        ]),
      )
    : "";
  useEffect(() => {
    if (!fingerprint || !session || !state.context || !state.versions) return;
    const abort = new AbortController();
    const context = state.context,
      versions = state.versions;
    const current = () => {
      const latest = store.getState();
      return (
        !abort.signal.aborted &&
        latest.reading.context === context &&
        latest.reading.versions === versions &&
        latest.tarot?.selections.length === 3 &&
        latest.tarot.selections.every((c) => c.revealed) &&
        JSON.stringify(
          latest.tarot.selections.map((c) => [
            c.card.cardId,
            c.card.orientation,
            c.positionId,
          ]),
        ) === fingerprint
      );
    };
    store.getState().setReading({ status: "loading", error: "", plan: null });
    setPack(null);
    void Promise.all([
      Promise.resolve().then(async () => {
        if (abort.signal.aborted) throw new Error("ABANDONED");
        if (providedInterpret === false)
          throw new Error("READING_FIXTURE_UNAVAILABLE");
        const interpret =
          providedInterpret ??
          (await import("@pxoracle/engine-client/tarot")).interpret;
        if (abort.signal.aborted) throw new Error("ABANDONED");
        return interpret(readingInput(session, context, versions));
      }),
      loadProse(versions, abort.signal),
    ])
      .then(([plan, prose]) => {
        if (!current()) return;
        validateReferences(plan, prose);
        setPack(prose);
        store.getState().setReading({ plan, status: "ready", error: "" });
      })
      .catch((error) => {
        if (current())
          store.getState().setReading({
            status: "error",
            error:
              error?.message === "READING_VERSION"
                ? "READING_VERSION"
                : "READING_FAILED",
          });
      });
    return () => abort.abort();
  }, [
    fingerprint,
    state.context,
    state.versions,
    attempt,
    store,
    providedInterpret,
  ]);
  return { ...state, pack, retry: () => setAttempt((n) => n + 1) };
}
