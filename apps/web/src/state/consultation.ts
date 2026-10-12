import type { BirthInput } from "@pxoracle/contracts";
import type { PlaceProvenance } from "@pxoracle/contracts/atlas";

/**
 * Oracle-led astrology consultation: service choice, dialogue stage and camera
 * presentation. This state never contains chart results; it only records what the
 * reader asked for, which birth details are confirmed and which view is shown.
 */
export type ConsultationService = "natal" | "horoscopes" | null;
/** Dialogue stage shown in the HTML panel/bubble. */
export type ConsultationStage =
  | "hub"
  | "horoscopes"
  | "greeting"
  | "birthplace"
  | "details"
  | "review";
/** Camera/world presentation. Chart existence never selects a presentation. */
export type Presentation = "consultation" | "globe" | "crystal";
/** Hydration-safe probe result for locally saved natal data. */
export type SavedAvailability =
  | "unknown"
  | "none"
  | "current"
  | "legacy"
  | "input-only"
  | "unsupported"
  | "corrupt"
  | "unavailable";

export interface ConfirmedBirthplace {
  label: string;
  timezone: string;
  latitude: number;
  longitude: number;
  provenance: PlaceProvenance;
}
export interface BirthDraft {
  date: string;
  time: string;
  accuracy: BirthInput["accuracy"];
  uncertaintyMinutes: number;
}
export interface ConsultationState {
  service: ConsultationService;
  stage: ConsultationStage;
  presentation: Presentation;
  /** Increments on every stage or presentation change; late callbacks compare it. */
  revision: number;
  /** Explicitly confirmed birthplace. Browsing a candidate never changes it. */
  birthplace: ConfirmedBirthplace | null;
  /** Date/time/accuracy entries retained across stages until a new chart begins. */
  draft: BirthDraft | null;
  saved: SavedAvailability;
}
export type ConsultationIntent =
  | { type: "arrive" }
  | { type: "service"; service: "natal" | "horoscopes" }
  | { type: "hub" }
  | { type: "saved"; availability: SavedAvailability }
  | { type: "explore-birthplace" }
  | { type: "confirm-birthplace"; birthplace: ConfirmedBirthplace }
  | { type: "cancel-birthplace" }
  | { type: "draft"; draft: Partial<BirthDraft> }
  | { type: "details" }
  | { type: "review" }
  | { type: "use-saved"; birthplace: ConfirmedBirthplace; draft: BirthDraft; stage?: "details" | "review" }
  | { type: "new-chart" }
  | { type: "open-crystal" }
  | { type: "return" };

export const emptyDraft = (): BirthDraft => ({ date: "", time: "", accuracy: "exact", uncertaintyMinutes: 30 });
export const emptyConsultation = (): ConsultationState => ({
  service: null,
  stage: "hub",
  presentation: "consultation",
  revision: 0,
  birthplace: null,
  draft: null,
  saved: "unknown",
});

/** The stage a reader returns to at the table once birthplace exploration ends. */
function tableStage(state: ConsultationState): ConsultationStage {
  if (state.stage === "birthplace") return state.birthplace ? "details" : "greeting";
  // Leaving the crystal offers resume/continue choices rather than re-asking for calculation.
  if (state.presentation === "crystal") return "hub";
  return state.stage;
}

export function navigateConsultation(state: ConsultationState, intent: ConsultationIntent): ConsultationState {
  const revision = state.revision + 1;
  switch (intent.type) {
    case "arrive":
      // Ordinary entry, reload and in-app reentry begin at the table. Data is retained.
      if (state.stage === "hub" && state.presentation === "consultation") return state;
      return { ...state, stage: "hub", presentation: "consultation", revision };
    case "service":
      return { ...state, service: intent.service, stage: intent.service === "natal" ? "greeting" : "horoscopes", presentation: "consultation", revision };
    case "hub":
      return { ...state, service: null, stage: "hub", presentation: "consultation", revision };
    case "saved":
      return state.saved === intent.availability ? state : { ...state, saved: intent.availability };
    case "explore-birthplace":
      return { ...state, service: "natal", stage: "birthplace", presentation: "globe", revision };
    case "confirm-birthplace":
      return { ...state, service: "natal", birthplace: intent.birthplace, stage: "details", presentation: "consultation", revision };
    case "cancel-birthplace":
      return { ...state, service: "natal", stage: state.birthplace ? "details" : "greeting", presentation: "consultation", revision };
    case "draft":
      return { ...state, draft: { ...(state.draft ?? emptyDraft()), ...intent.draft } };
    case "details":
      return { ...state, service: "natal", stage: state.birthplace ? "details" : "birthplace", presentation: state.birthplace ? "consultation" : "globe", revision };
    case "review":
      if (!state.birthplace) return { ...state, service: "natal", stage: "birthplace", presentation: "globe", revision };
      return { ...state, service: "natal", stage: "review", presentation: "consultation", draft: state.draft ?? emptyDraft(), revision };
    case "use-saved":
      // Saved or recorded details are reviewed at the table; the globe is skipped entirely.
      return { ...state, service: "natal", birthplace: intent.birthplace, draft: intent.draft, stage: intent.stage ?? "review", presentation: "consultation", revision };
    case "new-chart":
      // A new chart clears the draft and confirmed place only; saved storage and any current chart are untouched.
      return { ...state, service: "natal", birthplace: null, draft: null, stage: "birthplace", presentation: "globe", revision };
    case "open-crystal":
      return state.presentation === "crystal" ? state : { ...state, presentation: "crystal", revision };
    case "return":
      // Presentation navigation only: chart, draft, confirmed place and saves stay.
      if (state.presentation === "consultation" && state.stage !== "birthplace") return state;
      return { ...state, stage: tableStage(state), presentation: "consultation", revision };
  }
}

/** Combine the confirmed birthplace and draft into the engine input. Null when incomplete. */
export function birthInputFrom(birthplace: ConfirmedBirthplace | null, draft: BirthDraft | null, fold: BirthInput["fold"] = null): BirthInput | null {
  if (!birthplace || !draft || !draft.date) return null;
  if (draft.accuracy !== "unknown" && !draft.time) return null;
  return {
    date: draft.date,
    time: draft.accuracy === "unknown" ? null : draft.time,
    accuracy: draft.accuracy,
    timezone: birthplace.timezone,
    latitude: birthplace.latitude,
    longitude: birthplace.longitude,
    uncertaintyMinutes: draft.accuracy === "approximate" ? draft.uncertaintyMinutes : null,
    fold,
  };
}

/** Rebuild confirmed birthplace and draft from a recorded birth input and its provenance. */
export function consultationFromInput(input: BirthInput, place: PlaceProvenance | null): { birthplace: ConfirmedBirthplace; draft: BirthDraft } {
  const provenance: PlaceProvenance = place ?? { source: "manual", label: "Saved birthplace", cityId: null, country: null, atlasVersion: null };
  return {
    birthplace: { label: provenance.label, timezone: input.timezone, latitude: input.latitude, longitude: input.longitude, provenance },
    draft: { date: input.date, time: input.time ?? "", accuracy: input.accuracy, uncertaintyMinutes: input.uncertaintyMinutes ?? 30 },
  };
}
