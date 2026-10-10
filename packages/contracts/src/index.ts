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
export interface TarotContent {
  version: string;
  cards: Record<
    string,
    { name: string; theme: string; upright: string; reversed: string }
  >;
  positions: Record<string, string>;
}
export interface ViewData {
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
