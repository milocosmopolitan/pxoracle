"use client";
import { useEffect, useRef, useState } from "react";
import type { BirthInput } from "@pxoracle/contracts";
import type { NatalInput } from "@pxoracle/contracts/natal";
import type { PlaceProvenance } from "@pxoracle/contracts/atlas";
import { useOracleStore } from "../../state/store";
import {
  loadNatalContent,
  NATAL_VERSIONS,
  validatePlanReferences,
  type NatalContent,
} from "./content";
import {
  deleteNatal,
  inputsMatch,
  readNatal,
  saveNatal,
  samePlan,
  type RestoreCandidate,
} from "./persistence";
export type NatalEngine = Pick<
  typeof import("@pxoracle/engine-client/astrology"),
  "calculateNatal" | "restoreNatal" | "interpretNatal"
>;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "ERROR";
export function useNatal(providedEngine?: NatalEngine) {
  const store = useOracleStore();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [content, setContent] = useState<NatalContent | null>(null);
  const [pending, setPending] = useState<RestoreCandidate | null>(null);
  // Increments after explicit Save/Delete so a read-only saved-data probe can refresh.
  const [storageRevision, setStorageRevision] = useState(0);
  const [initial, setInitial] = useState<BirthInput | null>(
    (store.getState().chart?.provenance.settings as BirthInput) ?? null,
  );
  const [initialPlace, setInitialPlace] = useState<PlaceProvenance | null>(
    store.getState().natal.place,
  );
  const generation = useRef(0),
    abort = useRef<AbortController | null>(null);
  const module = useRef<
    typeof import("@pxoracle/engine-client/astrology") | null
  >(null);
  const mounted = useRef(true);
  async function engine() {
    if (providedEngine) return providedEngine;
    module.current ??= await import("@pxoracle/engine-client/astrology");
    return module.current;
  }
  function begin() {
    ++generation.current;
    abort.current?.abort();
    abort.current = new AbortController();
    return { id: generation.current, signal: abort.current.signal };
  }
  function active(id: number) {
    return mounted.current && generation.current === id;
  }
  useEffect(() => {
    mounted.current = true;
    const state = store.getState();
    if (state.natal.plan) {
      const { id, signal } = begin();
      void loadNatalContent(signal)
        .then((pack) => {
          if (!active(id)) return;
          validatePlanReferences(state.natal.plan!, pack);
          setContent(pack);
        })
        .catch((e) => {
          if (active(id))
            store.getState().setNatal({ status: "error", error: message(e) });
        });
    }
    if (
      !state.natal.plan &&
      state.natal.facts &&
      state.natal.status === "loading"
    ) {
      void interpret(state.natal.facts, state.natal.restorePlan);
    }
    return () => {
      mounted.current = false;
      ++generation.current;
      abort.current?.abort();
      module.current?.evict();
    };
  }, [store]);
  async function interpret(facts: NatalInput, expected?: unknown) {
    const { id, signal } = begin();
    store.getState().setNatal({ status: "loading", error: "" });
    try {
      const api = await engine();
      if (!active(id)) return;
      const [plan, pack] = await Promise.all([
        api.interpretNatal(facts),
        loadNatalContent(signal),
      ]);
      if (!active(id)) return;
      validatePlanReferences(plan, pack);
      // A supported saved plan is checked against the same deterministic rules before display.
      if (expected && !samePlan(expected, plan))
        throw new Error("INVALID_SESSION");
      setContent(pack);
      store
        .getState()
        .setNatal({ plan, restorePlan: null, status: "ready", error: "" });
    } catch (e) {
      if (active(id))
        store.getState().setNatal({ status: "error", error: message(e) });
    }
  }
  async function calculate(input: BirthInput, place: PlaceProvenance) {
    const { id } = begin();
    setInitial(input);
    setInitialPlace(place);
    setBusy(true);
    setError("");
    setNotice("");
    setPending(null);
    try {
      const api = await engine();
      if (!active(id)) return;
      const result = await api.calculateNatal(input);
      if (!active(id)) return;
      store.getState().setChart(result.chart);
      store.getState().setNatal({ facts: result.facts, place });
      setBusy(false);
      void interpret(result.facts);
      return true;
    } catch (e) {
      if (active(id)) setError(message(e));
    } finally {
      if (active(id)) setBusy(false);
    }
    return false;
  }
  async function restore() {
    const { id } = begin();
    setBusy(true);
    setError("");
    setNotice("");
    let candidate: RestoreCandidate | null = null;
    try {
      candidate = readNatal(localStorage);
      if (!candidate) {
        setNotice("No saved chart on this device.");
        return;
      }
      setInitial(candidate.input);
      setInitialPlace(candidate.place);
      if (!candidate.chart) {
        setPending(candidate);
        setNotice(
          "This older save contains birth details only. Choose Calculate saved details to create a chart.",
        );
        return;
      }
      if (!inputsMatch(candidate.input, candidate.chart))
        throw new Error("INVALID_SESSION");
      const api = await engine();
      if (!active(id)) return;
      const result = await api.restoreNatal(candidate.chart);
      if (!active(id)) return;
      store.getState().setChart(result.chart);
      store.getState().setNatal({
        facts: result.facts,
        restorePlan: candidate.mode === "current" ? candidate.plan : null,
        place: candidate.place,
        restored:
          candidate.mode === "current"
            ? "current"
            : candidate.mode === "legacy"
              ? "legacy"
              : "unsupported",
      });
      setPending(null);
      setBusy(false);
      setNotice(
        candidate.mode === "current"
          ? "Saved chart restored without recalculation. Its saved interpretation is checked against the recorded versions."
          : "Saved chart restored without recalculation. Choose Generate interpretation to use the current content; the original save remains unchanged until you Save.",
      );
      if (candidate.mode === "current")
        void interpret(result.facts, candidate.plan);
      return true;
    } catch (e) {
      if (!active(id)) return false;
      setError(message(e));
      if (candidate && message(e) === "INCOMPATIBLE_CHART")
        setPending(candidate);
    } finally {
      if (active(id)) setBusy(false);
    }
    return false;
  }
  function save() {
    const s = store.getState();
    if (!s.chart || !s.natal.plan || s.natal.status !== "ready") return;
    try {
      saveNatal(localStorage, {
        schemaVersion: 1,
        input: s.chart.provenance.settings as BirthInput,
        chart: s.chart,
        plan: s.natal.plan,
        versions: NATAL_VERSIONS,
        place: s.natal.place,
        savedAt: new Date().toISOString(),
      });
      setNotice(
        "Chart, birth details and interpretation saved on this device.",
      );
      setStorageRevision((n) => n + 1);
    } catch {
      setNotice(
        "This browser could not save the reading. The current chart remains available.",
      );
    }
  }
  function remove() {
    try {
      deleteNatal(localStorage);
      setNotice("Saved chart and birth details deleted.");
      setStorageRevision((n) => n + 1);
    } catch {
      setNotice("Storage is unavailable.");
    }
  }
  return {
    busy,
    error,
    notice,
    content,
    initial,
    initialPlace,
    pending,
    calculate,
    restore,
    save,
    storageRevision,
    remove,
    retry: () => {
      const facts = store.getState().natal.facts;
      if (facts) void interpret(facts, store.getState().natal.restorePlan);
    },
    regenerate: () => {
      const facts = store.getState().natal.facts;
      if (facts) {
        store.getState().setNatal({ restorePlan: null });
        void interpret(facts);
      }
    },
    clearError: () => setError(""),
    recalculateSaved: () => {
      if (pending)
        void calculate(
          pending.input,
          pending.place ?? {
            source: "manual",
            label: "Saved birthplace",
            cityId: null,
            country: null,
            atlasVersion: null,
          },
        );
    },
  };
}
