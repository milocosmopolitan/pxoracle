export const PROTOCOL_VERSION = 1 as const;
export type Feature = "astrology" | "tarot";
export type RouteScene = "landing" | Feature;
export interface BirthInput {
  date: string;
  time: string | null;
  timezone: string;
  latitude: number;
  longitude: number;
  accuracy: "exact" | "approximate" | "unknown";
  fold: "earlier" | "later" | null;
  uncertaintyMinutes: number | null;
  orbs?: [number, number, number, number, number];
}
export interface Body {
  id: string;
  longitude: number;
  latitude: number;
  speed: number;
  sign: number;
  degree: number;
  possibleSigns: number[];
  house: number | null;
  meaningRef: string;
}
export interface Chart {
  schemaVersion: 1;
  engineVersion: string;
  bodies: Body[];
  angles: { asc: number; mc: number } | null;
  houses: number[] | null;
  aspects: {
    a: string;
    b: string;
    kind: string;
    angle: number;
    orb: number;
    meaningRef: string;
  }[];
  interval: string[];
  warnings: string[];
  provenance: Record<string, unknown>;
}
export interface Card {
  cardId: string;
  orientation: "upright" | "reversed";
}
export interface Selection {
  slot: number;
  positionId: string;
  revealed: boolean;
  card: Card;
  meaningRefs: string[];
}
/** Full serialized engine state, never a scene prop or analytics payload. */
export interface TarotSession {
  schemaVersion: 1;
  engineVersion: string;
  algorithm: string;
  deckId: string;
  contentVersion: string;
  spread: 1 | 3;
  deck: Card[];
  selections: Selection[];
  state: "selecting" | "reading" | "completed";
}
export interface ArtManifest {
  schemaVersion: 1;
  deckId: string;
  cards: Record<string, { name: string; url: string }>;
  assets: Record<string, { url: string; size: [number, number] }>;
}
/** [x, y, width, height] on the card canvas (CardPartsCatalog.canvas). */
export type CardRect = [number, number, number, number];
export type BannerSlot = "top" | "bottom";
export interface BannerChoice {
  style: string;
  text: "name" | "numeral" | "none";
}
/** Deck- or card-level look; a card's value replaces the deck default field by field. */
export interface CardLookSettings {
  frame: string;
  fit: "cover" | "contain";
  matte: string;
  banners: Record<BannerSlot, BannerChoice | null>;
  effect: string;
}
export interface DeckManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  license: string;
  defaults: CardLookSettings;
  cards: Record<
    string,
    {
      name: string;
      numeral: string;
      art: string;
    } & Partial<Omit<CardLookSettings, "banners">> & {
        banners?: Partial<Record<BannerSlot, BannerChoice | null>>;
      }
  >;
}
export interface CardEffect {
  id: string;
  outline: string;
  dust: string;
  billboard: string;
}
export interface CardPartsCatalog {
  schemaVersion: 1;
  canvas: [number, number];
  frames: Record<
    string,
    {
      name: string;
      url?: string;
      opening: CardRect;
      slots: Record<BannerSlot, CardRect>;
    }
  >;
  banners: Record<
    string,
    { name: string; url: string; textBox: CardRect; size: [number, number]; color: string; shadow?: string }
  >;
  effects: Record<string, Omit<CardEffect, "id"> & { name: string }>;
}
export interface DeckIndex {
  schemaVersion: 1;
  parts: string;
  decks: { id: string; name: string; url: string }[];
}
/** Fully resolved layers for one card face; the scene composes them without catalog lookups. */
export interface CardLook {
  canvas: [number, number];
  art: string;
  fit: "cover" | "contain";
  matte: string;
  opening: CardRect;
  frame?: string;
  banners: {
    slot: BannerSlot;
    url: string;
    rect: CardRect;
    textBox: CardRect;
    text: string;
    color: string;
    shadow?: string;
  }[];
  effect: CardEffect;
}
export interface TarotContent {
  version: string;
  cards: Record<
    string,
    { name: string; theme: string; upright: string; reversed: string }
  >;
  positions: Record<string, string>;
}
export type TarotPhase =
  | "conversation"
  | "approach"
  | "shuffle"
  | "fan"
  | "selecting"
  | "dealing"
  | "preparing"
  | "revealing"
  | "reading";
export interface TarotPresentation {
  readingFocus?: number | null;
  phase: TarotPhase;
  revision: number;
  page: number;
  focus: number | null;
  index: number;
  attempt: number;
  error: string;
  busy: boolean;
}
/** Presentation only: no hidden card identities, shuffled order, seed, or question. */
export interface TarotView {
  /** Review-only fixed camera and timeline samples; no engine state. */
  reviewShot?: "shuffle" | "selection" | "reveal" | "reading" | "detail";
  reviewProgress?: number;
  cameraProfile?: "A" | "B" | "C";
  handPose?: "rest" | "support" | "packet" | "pinch" | "release";
  readingPanel?: boolean;
  readingFocus?: number | null;
  phase: TarotPhase;
  revision: number;
  page: number;
  focus: number | null;
  index: number;
  attempt: number;
  spread: 1 | 3;
  cards: {
    slot: number;
    revealed: boolean;
    reversed: boolean;
    face?: string;
    name?: string;
    /** When present, `face` is a cache key and the scene composes the face from these layers. */
    look?: CardLook;
  }[];
  /** Cheap pre-baked highlight for choosing face-down cards; avoids the bloom pass. */
  selectionEffect?: CardEffect;
  onIntent?: (intent: {
    type: "select" | "focus" | "inspect";
    slot: number;
  }) => void;
  onEvent?: (event: {
    type: "done" | "ready" | "asset-error";
    revision: number;
  }) => void;
}
export interface ViewData {
  globe?: import("./globe-view").GlobeView;
  astrology?: import("./astrology-view").AstrologyView;
  tarot?: TarotView;
  bodies?: Pick<Body, "id" | "longitude">[];
  selectedBody?: string | null;
  revealedCount?: number;
}
export interface WireRequest {
  version: 1;
  id: number;
  payload: unknown;
}
export type WireResponse =
  | { version: 1; id: number; ok: true; result: unknown }
  | { version: 1; id: number; ok: false; error: { code: string } };
export function isWireResponse(x: unknown): x is WireResponse {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.version === 1 &&
    Number.isSafeInteger(r.id) &&
    typeof r.ok === "boolean" &&
    (r.ok
      ? "result" in r
      : !!r.error && typeof (r.error as { code?: unknown }).code === "string")
  );
}
export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
