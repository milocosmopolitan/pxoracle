import type { BirthInput, Chart } from "@pxoracle/contracts";
import type { InterpretationPlan } from "@pxoracle/contracts/natal";
import { ATLAS_COUNTRIES, type PlaceProvenance } from "@pxoracle/contracts/atlas";
import { validateBirth, validateChart } from "../persistence-validators";
import { currentVersions } from "./content";
export const NATAL_KEY = "pxoracle.natal-report.v1";
export const NATAL_KEYS = [
  NATAL_KEY,
  "pxoracle.astrology-chart.v1",
  "pxoracle.astrology.v1",
];
export interface NatalSaved {
  schemaVersion: 1;
  input: BirthInput;
  chart: Chart;
  plan: InterpretationPlan | null;
  versions: unknown;
  place: PlaceProvenance | null;
  savedAt: string;
}
export interface RestoreCandidate {
  input: BirthInput;
  chart: Chart | null;
  plan: unknown;
  place: PlaceProvenance | null;
  mode: "current" | "legacy" | "unsupported" | "input-only";
}
function parse(text: string) {
  if (text.length > 500000) throw new Error("INVALID_SESSION");
  return JSON.parse(text);
}
function validPlace(value: unknown): value is PlaceProvenance | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const p = value as PlaceProvenance;
  return (
    (p.source === "atlas" || p.source === "manual") &&
    typeof p.label === "string" &&
    p.label.length <= 500 &&
    [p.cityId, p.atlasVersion].every(
      (x) => x === null || (typeof x === "string" && x.length <= 100),
    ) &&
    (p.country === null || (typeof p.country === "string" && Object.hasOwn(ATLAS_COUNTRIES, p.country)))
  );
}
export function readNatal(
  storage: Pick<Storage, "getItem">,
): RestoreCandidate | null {
  const current = storage.getItem(NATAL_KEY);
  if (current) {
    const saved = parse(current) as NatalSaved;
    if (
      saved.schemaVersion !== 1 ||
      !validateBirth(saved.input) ||
      !validateChart(saved.chart) ||
      !validPlace(saved.place)
    )
      throw new Error("INVALID_SESSION");
    return {
      input: saved.input,
      chart: saved.chart,
      plan: saved.plan,
      place: saved.place,
      mode:
        currentVersions(saved.versions) &&
        saved.plan &&
        currentVersions(saved.plan.versions)
          ? "current"
          : "unsupported",
    };
  }
  const legacy = storage.getItem("pxoracle.astrology-chart.v1");
  if (legacy) {
    const saved = parse(legacy);
    if (
      saved.schemaVersion !== 1 ||
      !validateBirth(saved.value?.input) ||
      !validateChart(saved.value?.chart)
    )
      throw new Error("INVALID_SESSION");
    return {
      input: saved.value.input,
      chart: saved.value.chart,
      plan: null,
      place: null,
      mode: "legacy",
    };
  }
  const oldest = storage.getItem("pxoracle.astrology.v1");
  if (!oldest) return null;
  const saved = parse(oldest);
  if (saved.schemaVersion !== 1 || !validateBirth(saved.value))
    throw new Error("INVALID_SESSION");
  return {
    input: saved.value,
    chart: null,
    plan: null,
    place: null,
    mode: "input-only",
  };
}
export function inputsMatch(input: BirthInput, chart: Chart) {
  const recorded = chart.provenance.settings as BirthInput;
  const fields: (keyof BirthInput)[] = [
    "date",
    "time",
    "timezone",
    "latitude",
    "longitude",
    "accuracy",
    "fold",
    "uncertaintyMinutes",
  ];
  return (
    recorded &&
    fields.every((key) => (input[key] ?? null) === (recorded[key] ?? null)) &&
    JSON.stringify(input.orbs ?? [8, 4, 6, 6, 8]) ===
      JSON.stringify(recorded.orbs ?? [8, 4, 6, 6, 8])
  );
}
export function saveNatal(
  storage: Pick<Storage, "setItem">,
  value: NatalSaved,
) {
  if (
    !inputsMatch(value.input, value.chart) ||
    !currentVersions(value.versions)
  )
    throw new Error("INVALID_SESSION");
  storage.setItem(NATAL_KEY, JSON.stringify(value));
}
export function deleteNatal(storage: Pick<Storage, "removeItem">) {
  NATAL_KEYS.forEach((key) => storage.removeItem(key));
}

export function samePlan(a: unknown, b: unknown) {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
