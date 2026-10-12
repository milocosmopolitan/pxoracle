"use client";
import { useRef, type ReactNode } from "react";
import type { BirthInput } from "@pxoracle/contracts";
import type { BirthDraft, ConfirmedBirthplace, SavedAvailability } from "../../state/consultation";

/** Readable HTML dialogue anchored beside the oracle. Decorative sprites never carry text. */
export function OracleBubble({ stage, children, actions }: { stage: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="oracle-bubble" aria-label="The oracle" tabIndex={-1} data-stage={stage}>
      <p className="eyebrow">THE ORACLE</p>
      <p className="oracle-line" aria-live="polite">{children}</p>
      {actions && <div className="actions">{actions}</div>}
    </section>
  );
}

/** The first dialogue: the oracle offers the services as choices instead of a separate panel. */
export function HubBubble({
  hasChart,
  hasDraft,
  disabled = false,
  onNatal,
  onHoroscopes,
  onResumeChart,
  onContinueDraft,
}: {
  hasChart: boolean;
  hasDraft: boolean;
  /** Controls stay disabled until hydration owns their handlers, so no click is lost. */
  disabled?: boolean;
  onNatal: () => void;
  onHoroscopes: () => void;
  onResumeChart: () => void;
  onContinueDraft: () => void;
}) {
  return (
    <OracleBubble
      stage="hub"
      actions={
        <>
          <button type="button" disabled={disabled} onClick={onNatal}>Natal Chart</button>
          <button type="button" disabled={disabled} onClick={onHoroscopes}>Horoscopes</button>
          {hasChart && <button type="button" disabled={disabled} onClick={onResumeChart}>Resume the current chart</button>}
          {hasDraft && <button type="button" disabled={disabled} onClick={onContinueDraft}>Continue the birth details</button>}
        </>
      }
    >
      Come in. Shall we look at the sky you were born under, or at the days ahead?
    </OracleBubble>
  );
}

/** Horoscopes are not built yet: say so honestly and offer the way back. */
export function HoroscopesBubble({ onBack, onNatal, disabled = false }: { onBack: () => void; onNatal: () => void; disabled?: boolean }) {
  return (
    <OracleBubble
      stage="horoscopes"
      actions={
        <>
          <button type="button" disabled={disabled} onClick={onBack}>Back to the consultation</button>
          <button type="button" disabled={disabled} onClick={onNatal}>Natal Chart instead</button>
        </>
      }
    >
      Horoscopes are not ready in this room yet. For now I can only read the sky you were born under.
    </OracleBubble>
  );
}

/** Help opens a modal explaining the natal chart, replacing the always-visible explanatory panel. */
export function NatalHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  return (
    <>
      <button ref={trigger} type="button" className="stage-help" aria-label="About the natal chart" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        ?
      </button>
      <dialog ref={dialog} className="help-dialog" aria-labelledby="natal-help-title" onClick={(event) => event.target === dialog.current && close()}>
        <p className="eyebrow">NATAL CHART</p>
        <h2 id="natal-help-title">Your birth sky</h2>
        <p>
          A natal chart is a map of where the Sun, Moon and planets stood at the moment and place you were born.
          It is read as symbol and reflection, not as a prediction.
        </p>
        <p>
          A new chart needs your birthplace, the date and, if you know it, the time. Without a time the chart
          leaves out the Ascendant and houses.
        </p>
        <p>
          The calculation runs in this browser and nothing is sent anywhere. A chart is kept only if you choose
          Save, and you can delete it at any time.
        </p>
        <div className="actions">
          <button type="button" onClick={close} autoFocus>Got it</button>
        </div>
      </dialog>
    </>
  );
}

export interface GreetingActions {
  /** Hydration gate; separate from an in-flight restore so Back always works. */
  openSaved: () => void;
  useSaved: () => void;
  newChart: () => void;
  resumeChart: () => void;
  continueDraft: () => void;
  deleteSaved: () => void;
  back: () => void;
}

export function greetingLine(saved: SavedAvailability, label: string | null, date: string | null): string {
  const where = label ? ` from ${label}` : "";
  const when = date ? `, ${date}` : "";
  switch (saved) {
    case "unknown":
      return "Let me see whether you have left a chart with me…";
    case "none":
      return "No chart is kept on this device. To draw one I need where you were born, the date, and the time if you know it. Shall we begin?";
    case "current":
      return `I have a chart you saved here${where}${when}. Shall I open it, review its details, or shall we begin another?`;
    case "legacy":
      return `I have an older saved chart${where}${when}. It has no written report yet; I can open it and write one when you ask.`;
    case "input-only":
      return `I have only your saved birth details${where}${when}, not a finished chart. We can review them and calculate afresh.`;
    case "unsupported":
      return `Your saved chart${where} was written with versions this room no longer supports. I can still open the chart itself; a new report needs your say-so.`;
    case "corrupt":
      return "Something is saved here, but I cannot read it. We can begin a new chart, or you may clear the unreadable save.";
    case "unavailable":
      return "This browser will not let me look at saved charts. We can still draw one now; saving may not work here.";
  }
}

/** Dialogue actions are real state transitions; none calculates, regenerates or writes storage by itself. */
export function NatalGreeting({
  saved,
  label,
  date,
  hasChart,
  hasDraft,
  busy,
  disabled = false,
  actions,
}: {
  saved: SavedAvailability;
  label: string | null;
  date: string | null;
  hasChart: boolean;
  hasDraft: boolean;
  /** A restore is in flight: data actions wait, navigation stays available. */
  busy: boolean;
  /** Controls are disabled until hydration owns their handlers. */
  disabled?: boolean;
  actions: GreetingActions;
}) {
  const wait = busy || disabled;
  const openable = saved === "current" || saved === "legacy" || saved === "unsupported";
  const reviewable = openable || saved === "input-only";
  return (
    <OracleBubble
      stage="greeting"
      actions={
        <>
          {openable && <button type="button" disabled={wait} onClick={actions.openSaved}>Open saved chart</button>}
          {reviewable && <button type="button" disabled={wait} onClick={actions.useSaved}>Review saved details</button>}
          {saved !== "unknown" && <button type="button" disabled={wait} onClick={actions.newChart}>Begin a new chart</button>}
          {saved === "corrupt" && <button type="button" disabled={wait} onClick={actions.deleteSaved}>Delete the unreadable save</button>}
          {reviewable && <button type="button" disabled={wait} onClick={actions.deleteSaved}>Delete saved chart</button>}
          {hasChart && <button type="button" disabled={disabled} onClick={actions.resumeChart}>Resume the current chart</button>}
          {hasDraft && <button type="button" disabled={disabled} onClick={actions.continueDraft}>Continue the birth details</button>}
          <button type="button" disabled={disabled} onClick={actions.back}>Back</button>
        </>
      }
    >
      {greetingLine(saved, label, date)}
    </OracleBubble>
  );
}

export function BirthReview({
  birthplace,
  draft,
  busy,
  disabled = false,
  error,
  onCalculate,
  onEditDetails,
  onChangeBirthplace,
  onBack,
}: {
  birthplace: ConfirmedBirthplace;
  draft: BirthDraft;
  /** Calculation in flight: only the primary action waits; leaving the review stays possible. */
  busy: boolean;
  disabled?: boolean;
  error: string;
  onCalculate: (fold: BirthInput["fold"]) => void;
  onEditDetails: () => void;
  onChangeBirthplace: () => void;
  onBack: () => void;
}) {
  return (
    <form
      className="birth-review"
      aria-label="Birth details summary"
      onSubmit={(event) => {
        event.preventDefault();
        const fold = new FormData(event.currentTarget).get("fold");
        onCalculate((fold ? String(fold) : null) as BirthInput["fold"]);
      }}
    >
      <p className="eyebrow">A PLACE. A MOMENT. YOU.</p>
      <h2 tabIndex={-1}>Is this right?</h2>
      <dl className="birth-summary">
        <dt>Birthplace</dt>
        <dd>{birthplace.label}</dd>
        <dt>Coordinates and zone</dt>
        <dd>{birthplace.latitude}°, {birthplace.longitude}° · {birthplace.timezone}</dd>
        <dt>Date</dt>
        <dd>{draft.date}</dd>
        <dt>Time</dt>
        <dd>
          {draft.accuracy === "unknown"
            ? "Unknown — the whole local day is used"
            : `${draft.time}${draft.accuracy === "approximate" ? ` ± ${draft.uncertaintyMinutes} minutes` : " (exact)"}`}
        </dd>
      </dl>
      {draft.accuracy !== "exact" && (
        <p className="hint">Only midpoint positions and sampled sign alternatives will be shown. Ascendant, houses and aspects will be omitted.</p>
      )}
      {error === "AMBIGUOUS_LOCAL_TIME" && (
        <label>
          This clock time occurred twice. Which occurrence is recorded?
          <select name="fold" required defaultValue="">
            <option value="">Choose an occurrence</option>
            <option value="earlier">Earlier, before the clock moved back</option>
            <option value="later">Later, after the clock moved back</option>
          </select>
        </label>
      )}
      {error === "NONEXISTENT_LOCAL_TIME" && (
        <p role="alert">The clock skipped this local time. Check the recorded date and time; we will not move it automatically.</p>
      )}
      <button className="primary" disabled={busy || disabled}>
        {busy ? "Calculating…" : "Calculate and enter the crystal →"}
      </button>
      <div className="actions">
        <button type="button" disabled={disabled} onClick={onEditDetails}>Edit date and time</button>
        <button type="button" disabled={disabled} onClick={onChangeBirthplace}>Change birthplace</button>
        <button type="button" disabled={disabled} onClick={onBack}>Back to the consultation</button>
      </div>
    </form>
  );
}
