import type { SavedAvailability } from "../../state/consultation";
import { readNatal, type RestoreCandidate } from "./persistence";

export interface SavedProbe {
  availability: SavedAvailability;
  candidate: RestoreCandidate | null;
}

/**
 * Read-only, hydration-safe look at locally saved natal data. It never calculates,
 * generates an interpretation, migrates or rewrites storage. Distinguishes a usable
 * current chart, a legacy chart without report, input-only legacy saves, unsupported
 * versions, unreadable data and inaccessible storage.
 */
export function probeSaved(storage: () => Pick<Storage, "getItem">): SavedProbe {
  let store: Pick<Storage, "getItem">;
  try {
    store = storage();
    store.getItem("pxoracle.natal-probe");
  } catch {
    return { availability: "unavailable", candidate: null };
  }
  try {
    const candidate = readNatal(store);
    if (!candidate) return { availability: "none", candidate: null };
    return { availability: candidate.mode, candidate };
  } catch {
    return { availability: "corrupt", candidate: null };
  }
}
