import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { createLamp } from "./props/lamp";
import { createCandle } from "./props/candle";

// World coordinates: tarot's tabletop is y=-1 despite its rotated local parent.
export const STUDY_ANCHORS = {
  lamp: [-5.9, -1, 0.25], candle: [-1.45, -1, 0.9], globe: [-0.55, -1, 0.75],
  tarotLamp: [-7.25, -0.96, -0.9], tarotCandle: [1.2, -0.96, -0.7], tarotGlobe: [1.6, -0.96, 2.6],
} as const;

export async function createStudyProps(leases: TextureLeases, signal: AbortSignal, tarot = false) {
  const group = new THREE.Group();
  group.name = "prop-owned-study-lighting";
  const disposers: (() => void)[] = [];
  let dead = false;
  const dispose = () => { if (dead) return; dead = true; disposers.reverse().forEach(fn => fn()); group.removeFromParent(); group.clear(); };
  try {
    const lamp = await createLamp(leases, signal);
    disposers.push(lamp.dispose);
    lamp.group.position.fromArray(tarot ? STUDY_ANCHORS.tarotLamp : STUDY_ANCHORS.lamp);
    lamp.group.scale.setScalar(tarot ? 1.2 : 0.9);
    const candle = await createCandle(leases, signal);
    disposers.push(candle.dispose);
    candle.group.position.fromArray(tarot ? STUDY_ANCHORS.tarotCandle : STUDY_ANCHORS.candle);
    candle.group.scale.setScalar(tarot ? 1.1 : 0.75);
    const ambient = new THREE.HemisphereLight(0xc1cedb, 0x574432, 1.35);
    const window = new THREE.DirectionalLight(0xb3c6df, 1.8);
    window.position.set(-5, 7, 6);
    group.add(lamp.group, candle.group, ambient, window);
    if (signal.aborted) throw new Error("SCENE_ABANDONED");
    return { group, lamp, candle, dispose, update(time: number, reduced: boolean) { if (!dead) candle.update(time, reduced); } };
  } catch (error) { dispose(); throw error; }
}
