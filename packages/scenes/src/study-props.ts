import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { createLamp } from "./props/lamp";
import { createCandle } from "./props/candle";
import { studyDesk } from "./study-table";

// World coordinates: tarot's tabletop is y=-1 despite its rotated local parent.
export const STUDY_ANCHORS = {
  tarotLamp: [-7.25, -0.96, -0.9], tarotCandle: [1.2, -0.96, -0.7], tarotGlobe: [1.6, -0.96, 2.6],
} as const;
/** Painted rooms stand their props on the shared study desk surface. */
export function studyAnchors(mode: "landing" | "astrology") {
  const desk = studyDesk(mode);
  const at = (x: number, z: number): [number, number, number] => [x, desk.top, desk.rear + z * desk.depth];
  return { lamp: at(mode === "landing" ? -5.2 : -5.6, 0.42), candle: at(mode === "landing" ? -1.2 : -1.15, 0.26), globe: at(mode === "landing" ? -0.55 : -0.45, 0.62) };
}

export async function createStudyProps(leases: TextureLeases, signal: AbortSignal, mode: "landing" | "astrology" | "tarot" = "astrology") {
  const tarot = mode === "tarot";
  const anchors = tarot ? null : studyAnchors(mode);
  const group = new THREE.Group();
  group.name = "prop-owned-study-lighting";
  const disposers: (() => void)[] = [];
  let dead = false;
  const dispose = () => { if (dead) return; dead = true; disposers.reverse().forEach(fn => fn()); group.removeFromParent(); group.clear(); };
  try {
    const lamp = await createLamp(leases, signal);
    disposers.push(lamp.dispose);
    lamp.group.position.fromArray(anchors ? anchors.lamp : STUDY_ANCHORS.tarotLamp);
    lamp.group.scale.setScalar(tarot ? 1.2 : 0.9);
    const candle = await createCandle(leases, signal);
    disposers.push(candle.dispose);
    candle.group.position.fromArray(anchors ? anchors.candle : STUDY_ANCHORS.tarotCandle);
    candle.group.scale.setScalar(tarot ? 1.1 : 0.75);
    const ambient = new THREE.HemisphereLight(0xc1cedb, 0x574432, 1.35);
    const window = new THREE.DirectionalLight(0xb3c6df, 1.8);
    window.position.set(-5, 7, 6);
    group.add(lamp.group, candle.group, ambient, window);
    if (signal.aborted) throw new Error("SCENE_ABANDONED");
    return { group, lamp, candle, dispose, update(time: number, reduced: boolean) { if (!dead) candle.update(time, reduced); } };
  } catch (error) { dispose(); throw error; }
}
