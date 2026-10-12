import type {
  TarotSession,
  TarotPresentation,
  TarotView,
} from "@pxoracle/contracts";
import {
  lookKey,
  resolveCardLook,
  resolveEffect,
  type LoadedDeck,
} from "./deck";
export type TarotEngine = Pick<
  typeof import("@pxoracle/engine-client/tarot"),
  "create" | "select" | "reveal" | "restore" | "complete" | "evict"
>;
interface State {
  tarot: TarotSession | null;
  tarotPresentation: TarotPresentation;
}
export interface ControllerPort {
  get(): State;
  session(value: TarotSession | null): void;
  presentation(value: Partial<TarotPresentation>): void;
}
/** One owner serializes domain commands. Scene acknowledgements carry a generation. */
export class TarotController {
  private generation = 0;
  private locked = false;
  private disposed = false;
  constructor(
    private port: ControllerPort,
    private engine: () => Promise<TarotEngine>,
  ) {}
  private phase(
    phase: TarotPresentation["phase"],
    extra: Partial<TarotPresentation> = {},
  ) {
    this.port.presentation({
      phase,
      revision: ++this.generation,
      error: "",
      ...extra,
    });
  }
  private async command(
    fn: (engine: TarotEngine) => Promise<TarotSession>,
    after: () => void,
  ) {
    if (this.locked || this.disposed) return;
    this.locked = true;
    const id = ++this.generation;
    this.port.presentation({ busy: true, error: "", revision: id });
    try {
      const engine = await this.engine();
      if (id !== this.generation || this.disposed) return;
      const result = await fn(engine);
      if (id !== this.generation || this.disposed) return;
      this.port.session(result);
      after();
    } catch (error) {
      if (id === this.generation && !this.disposed)
        this.port.presentation({
          error: error instanceof Error ? error.message : "ENGINE_LOAD_FAILED",
        });
    } finally {
      if (!this.disposed && id <= this.generation) {
        this.locked = false;
        this.port.presentation({ busy: false });
      }
    }
  }
  start(spread: 1 | 3, reversals: boolean) {
    const s = this.port.get();
    if (
      s.tarot?.selections.length ||
      (s.tarot && s.tarotPresentation.phase !== "selecting")
    )
      return;
    return this.command(
      (e) => e.create(spread, reversals),
      () => this.phase("approach", { page: 0, index: 0, focus: null }),
    );
  }
  select(slot: number) {
    const { tarot: s, tarotPresentation: p } = this.port.get();
    if (
      !s ||
      p.phase !== "selecting" ||
      s.selections.length >= s.spread ||
      s.selections.some((x) => x.slot === slot)
    )
      return;
    return this.command(
      (e) => e.select(s, slot),
      () => this.phase("dealing", { index: s.selections.length, focus: null }),
    );
  }
  focus(slot: number) {
    if (!this.disposed) this.port.presentation({ focus: slot });
  }
  page(page: number) {
    if (this.port.get().tarotPresentation.phase === "selecting")
      this.port.presentation({
        page: Math.max(0, Math.min(6, page)),
        focus: null,
      });
  }
  event(event: { type: "done" | "ready" | "asset-error"; revision: number }) {
    const { tarot: s, tarotPresentation: p } = this.port.get();
    if (this.disposed || !s || event.revision !== p.revision || this.locked)
      return;
    if (event.type === "asset-error") {
      this.port.presentation({ error: "CARD_ART_FAILED" });
      return;
    }
    if (event.type === "ready" && p.phase === "preparing") {
      return this.command(
        (e) => e.reveal(s, p.index),
        () => this.phase("revealing"),
      );
    }
    if (event.type !== "done") return;
    if (p.phase === "approach") this.phase("shuffle");
    else if (p.phase === "shuffle") this.phase("fan");
    else if (p.phase === "fan") this.phase("selecting");
    else if (p.phase === "dealing") {
      if (s.selections.length === s.spread)
        this.phase("preparing", {
          index: s.selections.findIndex((x) => !x.revealed),
        });
      else this.phase("selecting");
    } else if (p.phase === "revealing") {
      const index = s.selections.findIndex((x) => !x.revealed);
      this.phase(index < 0 ? "reading" : "preparing", {
        index: Math.max(0, index),
      });
    }
  }
  retryArt() {
    const p = this.port.get().tarotPresentation;
    this.phase(p.phase, { attempt: p.attempt + 1 });
  }
  restore(value: unknown) {
    return this.command(
      (e) => e.restore(value),
      () => this.resume(),
    );
  }
  resume() {
    const s = this.port.get().tarot;
    const index = s?.selections.findIndex((x) => !x.revealed) ?? 0;
    this.phase(
      !s
        ? "conversation"
        : s.selections.length < s.spread
          ? "selecting"
          : index < 0
            ? "reading"
            : "preparing",
      { index: Math.max(0, index), busy: false },
    );
  }
  complete() {
    const s = this.port.get().tarot;
    if (s)
      return this.command(
        (e) => e.complete(s),
        () => this.phase("reading"),
      );
  }
  reset() {
    if (this.locked) return;
    this.port.session(null);
    this.phase("conversation", { page: 0, index: 0, focus: null });
  }
  dispose() {
    this.disposed = true;
    ++this.generation;
  }
}
export function tarotView(
  s: TarotSession | null,
  p: TarotPresentation,
  deck: LoadedDeck | null,
): TarotView {
  return {
    ...(deck
      ? { selectionEffect: resolveEffect(deck.parts, deck.deck.defaults.effect) }
      : {}),
    phase: p.phase,
    revision: p.revision,
    page: p.page,
    focus: p.focus,
    index: p.index,
    attempt: p.attempt,
    spread: s?.spread ?? 3,
    cards:
      s?.selections.map((x) => ({
        slot: x.slot,
        reversed: x.card.orientation === "reversed",
        revealed: x.revealed,
        ...(deck
          ? {
              face: lookKey(deck.deck.id, x.card.cardId),
              name: deck.deck.cards[x.card.cardId]?.name,
              look: resolveCardLook(deck, x.card.cardId),
            }
          : {}),
      })) ?? [],
  };
}
