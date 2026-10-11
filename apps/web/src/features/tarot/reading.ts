import type {
  Context,
  Versions,
  ReadingInput,
  ReadingPlan,
  Phrase,
} from "@pxoracle/contracts/reading";
import type { TarotSession } from "@pxoracle/contracts";
export const READING_VERSIONS: Versions = {
  schema: 1,
  engine: "reading.1",
  semantics: "semantics.1",
  rules: "rules.1",
  content: "reading.en.1",
};
export const TOPICS = {
  relationships: "Relationships",
  work: "Work and career",
  creativity: "Creativity and projects",
  growth: "Self and personal growth",
};
export const INTENTS = {
  present: "Understand the present",
  crossroads: "A crossroads",
  action: "A next step",
};
export function currentVersions(v: Versions) {
  return Object.entries(READING_VERSIONS).every(
    ([k, value]) => v[k as keyof Versions] === value,
  );
}
export type ProsePack = {
  schemaVersion: number;
  version: string;
  locale: string;
  strings: Record<string, string>;
};
export function readingInput(
  session: TarotSession,
  context: Context,
  versions: Versions,
): ReadingInput {
  if (
    session.spread !== 3 ||
    session.selections.length !== 3 ||
    session.selections.some((c) => !c.revealed)
  )
    throw new Error("READING_INPUT");
  return {
    versions,
    context,
    cards: session.selections.map((c) => ({
      cardId: c.card.cardId,
      orientation: c.card.orientation,
      positionId: c.positionId as ReadingInput["cards"][number]["positionId"],
    })),
  };
}
export function renderPhrase(phrase: Phrase, pack: ProsePack): string {
  const text = pack.strings[phrase.reference];
  if (typeof text !== "string") throw new Error("READING_CONTENT");
  const result = text.replace(/\{(\d+)\}/g, (_, n) => {
    const arg = pack.strings[phrase.arguments[Number(n)]];
    if (typeof arg !== "string") throw new Error("READING_CONTENT");
    return arg;
  });
  if (/\{[^}]*\}/.test(result)) throw new Error("READING_CONTENT");
  return result;
}
export async function loadProse(
  versions: Versions,
  signal: AbortSignal,
): Promise<ProsePack> {
  if (!currentVersions(versions)) throw new Error("READING_VERSION");
  const response = await fetch("/content/reading/reading.en.1.json", {
    signal,
  });
  if (!response.ok) throw new Error("READING_CONTENT");
  const text = await response.text();
  if (text.length > 750000) throw new Error("READING_CONTENT");
  const pack = JSON.parse(text) as ProsePack;
  if (
    pack.schemaVersion !== 1 ||
    pack.version !== versions.content ||
    pack.locale !== "en" ||
    !pack.strings ||
    Object.values(pack.strings).some(
      (s) => typeof s !== "string" || s.length > 1500,
    )
  )
    throw new Error("READING_CONTENT");
  return pack;
}
export function validateReferences(plan: ReadingPlan, pack: ProsePack) {
  [
    ...plan.overall,
    ...plan.relations.map((r) => r.phrase),
    plan.action,
    plan.question,
    ...plan.positions.flatMap((p) => p.phrases),
  ].forEach((p) => renderPhrase(p, pack));
  plan.cards.forEach((c) => {
    if (!pack.strings[`name.${c.cardId}`]) throw new Error("READING_CONTENT");
  });
}
export const ROLE_LABELS: Record<
  ReadingPlan["positions"][number]["role"],
  string
> = {
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
export const FALLBACK_RELATION_TEXT =
  "No strong relationship rule connected these cards. Follow their positions in order without forcing a shared theme.";
export const MAIN_CONNECTION_TEXT =
  "This is the main connection described above.";
/** The visible reading text. ReadingResult renders this shape and the offline CSV export serializes it. */
export function composeReading(plan: ReadingPlan, pack: ProsePack) {
  const text = (p: Phrase) => renderPhrase(p, pack);
  const name = (i: number) => pack.strings[`name.${plan.cards[i].cardId}`];
  return {
    overall: plan.overall.map(text).join(" "),
    fallbackText: plan.fallback ? FALLBACK_RELATION_TEXT : null,
    relations: plan.fallback
      ? []
      : plan.relations.map((r) => ({
          ruleId: r.ruleId,
          kind: r.kind,
          kindLabel: r.kind[0].toUpperCase() + r.kind.slice(1),
          cardNames: r.cardIndices.map(name),
          cardNumbers: r.cardIndices.map((i) => i + 1),
          text: plan.overall.some((p) => p.reference === r.phrase.reference)
            ? MAIN_CONNECTION_TEXT
            : text(r.phrase),
          fullText: text(r.phrase),
        })),
    action: text(plan.action),
    question: text(plan.question),
    positions: plan.positions.map((position) => {
      const card = plan.cards[position.index];
      return {
        index: position.index,
        role: position.role,
        roleLabel: ROLE_LABELS[position.role],
        lens: position.lens,
        cardId: card.cardId,
        cardName: name(position.index),
        orientation: card.orientation,
        paragraphs: position.phrases.map(text),
      };
    }),
  };
}
