"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {useOracle} from "../state/store";
import type {RouteScene} from "@pxoracle/contracts";
import {SceneCanvas} from "./SceneCanvas";
export default function SceneHost() {
  const path = usePathname();
  const chart = useOracle((s) => s.chart);
  const selectedBody = useOracle((s) => s.selectedBody);
  const tarot = useOracle((s) => s.tarot);
  const route: RouteScene = path.startsWith("/astrology")
    ? "astrology"
    : path.startsWith("/tarot")
      ? "tarot"
      : "landing";
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  }, [path]);
  return (
    <SceneCanvas
      route={route}
      data={{
        bodies: chart?.bodies,
        selectedBody,
        revealedCount: tarot?.selections.filter((x) => x.revealed).length,
      }}
    />
  );
}
