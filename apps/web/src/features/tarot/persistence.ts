import type { TarotSession } from "@pxoracle/contracts";
import type { Context, Versions } from "@pxoracle/contracts/reading";
import { TOPICS, INTENTS } from "./reading";
export type SavedTarot = {
  schemaVersion: 2;
  draw: unknown;
  perspective: Context | null;
  readingVersions: Versions | null;
};
const key = "pxoracle.tarot.v2";
function keys(
  value: unknown,
  expected: string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((k) => Object.hasOwn(value, k))
  );
}
export function parseSavedTarot(raw: string): SavedTarot {
  if (raw.length > 100000) throw new Error("SAVED_READING_INVALID");
  const data = JSON.parse(raw);
  if (keys(data, ["schemaVersion", "value"]) && data.schemaVersion === 1)
    return {
      schemaVersion: 2,
      draw: data.value,
      perspective: null,
      readingVersions: null,
    };
  if (
    !keys(data, ["schemaVersion", "draw", "perspective", "readingVersions"]) ||
    data.schemaVersion !== 2
  )
    throw new Error("SAVED_READING_INVALID");
  const c = data.perspective,
    v = data.readingVersions;
  if (
    c !== null &&
    (!keys(c, ["topic", "intent"]) ||
      !Object.hasOwn(TOPICS, String(c.topic)) ||
      !Object.hasOwn(INTENTS, String(c.intent)))
  )
    throw new Error("SAVED_READING_INVALID");
  if (
    v !== null &&
    (!keys(v, ["schema", "engine", "semantics", "rules", "content"]) ||
      !Number.isSafeInteger(v.schema) ||
      Number(v.schema) < 1 ||
      [v.engine, v.semantics, v.rules, v.content].some(
        (s) => typeof s !== "string" || !/^[a-z0-9._-]{1,96}$/.test(s),
      ))
  )
    throw new Error("SAVED_READING_INVALID");
  if ((c === null) !== (v === null)) throw new Error("SAVED_READING_INVALID");
  return data as SavedTarot;
}
export function readSavedTarot(storage: Storage): SavedTarot | null {
  const raw = storage.getItem(key) ?? storage.getItem("pxoracle.tarot.v1");
  return raw === null ? null : parseSavedTarot(raw);
}
export function saveTarot(
  storage: Storage,
  draw: TarotSession,
  perspective: Context | null,
  readingVersions: Versions | null,
) {
  const envelope: SavedTarot = {
    schemaVersion: 2,
    draw,
    perspective,
    readingVersions,
  };
  const raw = JSON.stringify(envelope);
  parseSavedTarot(raw);
  storage.setItem(key, raw);
}
export function deleteTarot(storage: Storage) {
  storage.removeItem(key);
  storage.removeItem("pxoracle.tarot.v1");
}
