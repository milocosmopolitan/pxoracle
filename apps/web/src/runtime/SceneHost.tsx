"use client";
import {useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {useOracle} from "../state/store";
import type {RouteScene} from "@pxoracle/contracts";
import {SceneCanvas} from "./SceneCanvas";
export default function SceneHost() {
  const path = usePathname();
  const router = useRouter();
  const requestGlobeEntry = useOracle(s => s.requestGlobeEntry);
  const globeView = useOracle(s => s.globeView);
  const setSceneReady = useOracle((s) => s.setSceneReady);
  const setEntrance = useOracle((s) => s.setEntrance);
  const tarotView = useOracle((s) => s.tarotView);
  const astrologyView = useOracle((s) => s.astrologyView);
  const landingCrystal = useOracle((s) => s.landingCrystal);
  const setLandingCrystal = useOracle((s) => s.setLandingCrystal);
  const route: RouteScene = path.startsWith("/astrology")
    ? "astrology"
    : path.startsWith("/tarot")
      ? "tarot"
      : "landing";
  useEffect(() => {
    // Hover never survives leaving the room.
    if (route !== "landing") setLandingCrystal({ scene: false, entry: false });
  }, [route, setLandingCrystal]);
  useEffect(() => {
    // A lazy scene may mount after the reader has already focused a control.
    // Preserve that intent; navigation from outside main still announces its heading.
    const active = document.activeElement;
    if (active && active !== document.body && document.querySelector("main")?.contains(active)) return;
    document.querySelector<HTMLElement>("h1")?.focus();
  }, [path]);
  return (
    <SceneCanvas
      route={route}
      crystal={route === "landing" ? (landingCrystal.scene || landingCrystal.entry ? "lit" : "dormant") : undefined}
      onStatus={(status) => {
        setSceneReady(!status);
        if (status && status !== "Preparing the room…") setEntrance("entered");
      }}
      data={{
        globe: route === "landing" ? { phase: "room", region: null, country: null, revision: 0, viewport: {left:0,top:0,width:1,height:1}, onIntent: () => { requestGlobeEntry(); router.push("/astrology/"); } } : route === "astrology" ? globeView : undefined,
        landing: route === "landing" ? {
          crystalLit: landingCrystal.entry,
          onCrystal: (intent) => {
            if (intent.type === "hover") setLandingCrystal({ scene: intent.active });
            else router.push("/astrology/");
          },
        } : undefined,
        tarot: route === "tarot" ? tarotView : undefined,
        astrology: route === "astrology" ? astrologyView : undefined,
      }}
    />
  );
}
