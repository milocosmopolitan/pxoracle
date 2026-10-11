"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { DoorEntrance } from "./DoorEntrance";
import { StateProvider } from "../state/store";
const SceneHost = dynamic(() => import("./SceneHost"), { ssr: false });
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <StateProvider>
      <SceneHost />
      <DoorEntrance />
      {children}
    </StateProvider>
  );
}
