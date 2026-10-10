"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Chart, TarotSession } from "@pxoracle/contracts";
export interface AppState {
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
    chart: null,
    tarot: null,
    selectedBody: null,
    question: "",
    setChart: (chart) =>
      set({ chart, selectedBody: chart?.bodies[0]?.id ?? null }),
    setTarot: (tarot) => set({ tarot }),
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
