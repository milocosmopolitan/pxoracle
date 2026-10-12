import type {
  BannerSlot,
  CardEffect,
  CardLook,
  CardPartsCatalog,
  DeckIndex,
  DeckManifest,
} from "@pxoracle/contracts";

export interface LoadedDeck {
  deck: DeckManifest;
  parts: CardPartsCatalog;
}

export const DEFAULT_DECK = "pxoracle";
const SLOTS: BannerSlot[] = ["top", "bottom"];

export function resolveEffect(parts: CardPartsCatalog, id: string): CardEffect {
  const effect = parts.effects[id];
  if (!effect) throw new Error(`Unknown card effect ${id}`);
  return { id, outline: effect.outline, dust: effect.dust, billboard: effect.billboard };
}

/** Card settings replace deck defaults field by field; banner slots resolve independently. */
export function resolveCardLook(
  { deck, parts }: LoadedDeck,
  cardId: string,
): CardLook {
  const card = deck.cards[cardId];
  if (!card) throw new Error(`Deck ${deck.id} has no ${cardId}`);
  const d = deck.defaults;
  const frameId = card.frame ?? d.frame;
  const frame = parts.frames[frameId];
  if (!frame) throw new Error(`Unknown card frame ${frameId}`);
  const banners = SLOTS.flatMap((slot) => {
    const choice =
      card.banners && slot in card.banners
        ? card.banners[slot]
        : d.banners[slot];
    if (!choice) return [];
    const banner = parts.banners[choice.style];
    if (!banner) throw new Error(`Unknown card banner ${choice.style}`);
    const rect = frame.slots[slot];
    const [bw, bh] = banner.size;
    const sx = rect[2] / bw,
      sy = rect[3] / bh;
    const [tx, ty, tw, th] = banner.textBox;
    // Banner art is authored for the bottom slot; the top slot mirrors it vertically.
    const y = slot === "top" ? bh - ty - th : ty;
    return [
      {
        slot,
        url: banner.url,
        rect,
        textBox: [rect[0] + tx * sx, rect[1] + y * sy, tw * sx, th * sy] as CardLook["banners"][number]["textBox"],
        text:
          choice.text === "name"
            ? card.name
            : choice.text === "numeral"
              ? card.numeral
              : "",
        color: banner.color,
        ...(banner.shadow ? { shadow: banner.shadow } : {}),
      },
    ];
  });
  return {
    canvas: parts.canvas,
    art: card.art,
    fit: card.fit ?? d.fit,
    matte: card.matte ?? d.matte,
    opening: frame.opening,
    ...(frame.url ? { frame: frame.url } : {}),
    banners,
    effect: resolveEffect(parts, card.effect ?? d.effect),
  };
}

/** Stable texture cache key: the same deck card always composes the same face. */
export const lookKey = (deckId: string, cardId: string) =>
  `deck:${deckId}/${cardId}`;

export async function loadDeckIndex(signal: AbortSignal) {
  const response = await fetch("/art/decks/index.json", { signal });
  if (!response.ok) throw new Error("deck index");
  const index = (await response.json()) as DeckIndex;
  if (index.schemaVersion !== 1 || !index.decks.length)
    throw new Error("deck index");
  return index;
}

export async function loadDeck(
  index: DeckIndex,
  id: string,
  signal: AbortSignal,
): Promise<LoadedDeck> {
  const entry = index.decks.find((d) => d.id === id) ?? index.decks[0];
  const [d, p] = await Promise.all([
    fetch(entry.url, { signal }),
    fetch(index.parts, { signal }),
  ]);
  if (!d.ok || !p.ok) throw new Error("deck");
  const loaded = {
    deck: (await d.json()) as DeckManifest,
    parts: (await p.json()) as CardPartsCatalog,
  };
  if (
    loaded.deck.schemaVersion !== 1 ||
    loaded.parts.schemaVersion !== 1 ||
    Object.keys(loaded.deck.cards).length !== 78
  )
    throw new Error("deck");
  // Fail at load, not mid-reading, when a deck names a part the catalog lacks.
  for (const cardId of Object.keys(loaded.deck.cards))
    resolveCardLook(loaded, cardId);
  return loaded;
}
