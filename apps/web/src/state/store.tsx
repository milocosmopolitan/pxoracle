"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type {
  Chart,
  TarotSession,
  TarotPresentation,
  TarotView,
} from "@pxoracle/contracts";
import type {
  Context as ReadingContext,
  Versions,
  ReadingPlan,
} from "@pxoracle/contracts/reading";
export interface ReadingState {
  context: ReadingContext | null;
  versions: Versions | null;
  plan: ReadingPlan | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
}
export const emptyReading = (): ReadingState => ({
  context: null,
  versions: null,
  plan: null,
  status: "idle",
  error: "",
});
import type { NatalInput, InterpretationPlan } from "@pxoracle/contracts/natal";
import type { PlaceProvenance } from "@pxoracle/contracts/atlas";
import type { AstrologySelection, AstrologyView } from "@pxoracle/contracts/astrology-view";
export interface NatalState {
  facts: NatalInput | null;
  restorePlan: unknown;
  plan: InterpretationPlan | null;
  place: PlaceProvenance | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  selection: AstrologySelection;
  revision: number;
  restored: "none" | "legacy" | "current" | "unsupported";
}
export const emptyNatal = (): NatalState => ({ facts: null, restorePlan: null, plan: null, place: null, status: "idle", error: "", selection: null, revision: 0, restored: "none" });
export interface AppState {
  natal: NatalState;
  setNatal: (value: Partial<NatalState>) => void;
  astrologyView: AstrologyView | undefined;
  setAstrologyView: (view: AstrologyView | undefined) => void;
  reading: ReadingState;
  setReading: (value: Partial<ReadingState>) => void;
  tarotPresentation: TarotPresentation;
  tarotView: TarotView | undefined;
  setTarotView: (tarotView: TarotView | undefined) => void;
  setTarotPresentation: (value: Partial<TarotPresentation>) => void;
  sceneReady: boolean;
  setSceneReady: (ready: boolean) => void;
  entrance: "waiting" | "opening" | "entered";
  setEntrance: (phase: "waiting" | "opening" | "entered") => void;
  chart: Chart | null;
  tarot: TarotSession | null;
  selectedBody: string | null;
  question: string;
  setChart: (chart: Chart | null) => void;
  setTarot: (tarot: TarotSession | null) => void;
  setBody: (body: string | null) => void;
  setQuestion: (q: string) => void;
}
export function createAppStore() {
  return createStore<AppState>()((set) => ({
    tarotPresentation: {
      phase: "conversation",
      revision: 0,
      page: 0,
      focus: null,
      index: 0,
      attempt: 0,
      error: "",
      busy: false,
    },
    natal: emptyNatal(),
    setNatal: value => set(s => ({ natal: { ...s.natal, ...value } })),
    astrologyView: undefined,
    setAstrologyView: astrologyView => set({ astrologyView }),
    reading: emptyReading(),
    setReading: (value) =>
      set((s) => ({ reading: { ...s.reading, ...value } })),
    tarotView: undefined,
    setTarotView: (tarotView) => set({ tarotView }),
    setTarotPresentation: (value) =>
      set((s) => ({ tarotPresentation: { ...s.tarotPresentation, ...value } })),
    sceneReady: false,
    setSceneReady: (sceneReady) => set({ sceneReady }),
    entrance: "waiting",
    setEntrance: (entrance) => set({ entrance }),
    chart: null,
    tarot: null,
    selectedBody: null,
    question: "",
    setChart: (chart) =>
      set(s => ({ chart, selectedBody: null, natal: { ...emptyNatal(), revision: s.natal.revision + 1 } })),
    setTarot: (tarot) =>
      set((s) => ({ tarot, reading: tarot ? s.reading : emptyReading() })),
    setBody: (selectedBody) => set({ selectedBody }),
    setQuestion: (question) => set({ question }),
  }));
}
const Context = createContext<StoreApi<AppState> | null>(null);
export function StateProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createAppStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useOracle<T>(selector: (state: AppState) => T) {
  const store = useContext(Context);
  if (!store) throw new Error("Missing StateProvider");
  return useStore(store, selector);
}

export function useOracleStore() {
  const store = useContext(Context);
  if (!store) throw new Error("Missing StateProvider");
  return store;
}
