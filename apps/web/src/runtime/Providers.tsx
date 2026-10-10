"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { StateProvider } from "../state/store";
const SceneHost = dynamic(() => import("./SceneHost"), { ssr: false });
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <StateProvider>
      <SceneHost />
      {children}
    </StateProvider>
  );
}
