"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {useOracle} from "../state/store";
import type {RouteScene} from "@pxoracle/contracts";
import {SceneCanvas} from "./SceneCanvas";
export default function SceneHost() {
  const path = usePathname();
  const setSceneReady = useOracle((s) => s.setSceneReady);
  const setEntrance = useOracle((s) => s.setEntrance);
  const tarotView = useOracle((s) => s.tarotView);
  const astrologyView = useOracle((s) => s.astrologyView);
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
      onStatus={(status) => {
        setSceneReady(!status);
        if (status && status !== "Preparing the room…") setEntrance("entered");
      }}
      data={{
        tarot: route === "tarot" ? tarotView : undefined,
        astrology: route === "astrology" ? astrologyView : undefined,
      }}
    />
  );
}
