"use client";
import type { Context, ReadingPlan } from "@pxoracle/contracts/reading";
import { TOPICS, INTENTS, renderPhrase, type ProsePack } from "./reading";
const roleLabels = {
  visible: "Visible situation",
  examination: "What to examine",
  direction: "Helpful direction",
  values: "What matters to you",
  conditions: "Overlooked conditions",
  checks: "Checks before deciding",
  foundation: "Your foundation",
  difficulty: "A difficulty to account for",
  small_action: "A small action",
};
export function PerspectiveFields({
  value,
  onChange,
}: {
  value: Context;
  onChange: (v: Context) => void;
}) {
  return (
    <div className="two">
      <label>
        Topic
        <select
          aria-label="Topic"
          value={value.topic}
          onChange={(e) =>
            onChange({ ...value, topic: e.target.value as Context["topic"] })
          }
        >
          {Object.entries(TOPICS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Intention
        <select
          aria-label="Intention"
          value={value.intent}
          onChange={(e) =>
            onChange({ ...value, intent: e.target.value as Context["intent"] })
          }
        >
          {Object.entries(INTENTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function ReadingResult({
  plan,
  pack,
  focus,
  onFocus,
}: {
  plan: ReadingPlan;
  pack: ProsePack;
  focus: number | null;
  onFocus: (index: number) => void;
}) {
  const text = (p: Parameters<typeof renderPhrase>[0]) => renderPhrase(p, pack);
  return (
    <section className="structured-reading" aria-label="Three-card reflection">
      <p className="reading-disclosure">
        A reflection on {TOPICS[plan.context.topic].toLowerCase()}. Your private
        note is not analyzed. These prompts do not predict an outcome.
      </p>
      <h3>The whole reading</h3>
      <p>{plan.overall.map(text).join(" ")}</p>
      <h3>Connections and themes</h3>
      {plan.fallback ? (
        <p>
          No strong relationship rule connected these cards. Follow their
          positions in order without forcing a shared theme.
        </p>
      ) : (
        plan.relations.map((r) => (
          <p key={r.ruleId}>
            <strong>{r.kind[0].toUpperCase() + r.kind.slice(1)}</strong> ·{" "}
            {r.cardIndices
              .map((i) => pack.strings[`name.${plan.cards[i].cardId}`])
              .join(" / ")}
            .{" "}
            {plan.overall.some((p) => p.reference === r.phrase.reference)
              ? "This is the main connection described above."
              : text(r.phrase)}{" "}
            <small>Cards {r.cardIndices.map((i) => i + 1).join(", ")}</small>
          </p>
        ))
      )}
      <h3>One small action</h3>
      <p className="prompt">{text(plan.action)}</p>
      <h3>A question to sit with</h3>
      <p>{text(plan.question)}</p>
      <h3>Your cards, in order</h3>
      {plan.positions.map((position) => {
        const card = plan.cards[position.index];
        return (
          <article className="reading-card" key={position.index}>
            <p className="eyebrow">
              {position.index + 1} · {roleLabels[position.role]}
            </p>
            <h4>
              <button
                className="text-button"
                aria-pressed={focus === position.index}
                onClick={() => onFocus(position.index)}
              >
                {pack.strings[`name.${card.cardId}`]}
              </button>
            </h4>
            <small>
              {card.orientation}
              {position.lens !== "direct" ? ` · ${position.lens}` : ""}
            </small>
            {position.phrases.map((p, i) => (
              <p key={i}>{text(p)}</p>
            ))}
          </article>
        );
      })}
      <details>
        <summary>How this reflection was assembled</summary>
        <p>
          {INTENTS[plan.context.intent]}. Card indices follow selection order.
          The same cards, perspective and versions produce the same reading.
        </p>
        <p>
          {plan.relations
            .map(
              (r) =>
                `${r.ruleId}: cards ${r.cardIndices.map((i) => i + 1).join(", ")}`,
            )
            .join("; ") || "Position flow fallback"}
        </p>
        <small>
          {Object.entries(plan.versions)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </small>
      </details>
    </section>
  );
}

export function ReadingFailure({ retry }: { retry: () => void }) {
  return (
    <div role="alert">
      <p>The reflection could not load. Your selected cards are unchanged.</p>
      <button onClick={retry}>Retry reflection</button>
    </div>
  );
}
export function LegacyPerspective({
  value,
  onChange,
  onConfirm,
}: {
  value: Context;
  onChange: (value: Context) => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <p>
        This saved draw has no recorded perspective. Your cards are unchanged.
        Choose a perspective explicitly to interpret them.
      </p>
      <PerspectiveFields value={value} onChange={onChange} />
      <button onClick={onConfirm}>Use this perspective</button>
    </div>
  );
}
export function UnsupportedReading({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div role="alert">
      <p>
        This reading uses unavailable interpretation versions. Its cards are
        preserved. Reinterpreting with current content will update the wording
        and may change the interpretation.
      </p>
      <button onClick={onConfirm}>
        Reinterpret these cards with current content
      </button>
    </div>
  );
}
