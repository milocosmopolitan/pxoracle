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
export interface AppState {
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
      set({ chart, selectedBody: chart?.bodies[0]?.id ?? null }),
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
