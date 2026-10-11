import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { createGlobe } from "./globe/index";
import { STUDY_ANCHORS } from "./study-props";

export async function createStudyGlobe(leases: TextureLeases, signal: AbortSignal, tarot = false, quality: "room" | "country" = "country") {
  const globe = await createGlobe(leases, signal, {quality});
  globe.group.position.fromArray(tarot ? STUDY_ANCHORS.tarotGlobe : STUDY_ANCHORS.globe);
  globe.group.scale.setScalar(.78);
  return globe;
}

export async function createStudyTable(leases: TextureLeases, signal: AbortSignal) {
  const lease = await leases.acquire("/art/hand-mesh/table-reference-albedo.png");
  if (signal.aborted) { lease.release(); throw new Error("SCENE_ABANDONED"); }
  const geometry = new THREE.BoxGeometry(9, .045, 3.4);
  const material = new THREE.MeshStandardMaterial({ map: lease.texture, color: 0x93765a, roughness: .88 });
  const group = new THREE.Mesh(geometry, material);
  group.name = "study-light-responsive-desk";
  group.position.set(-3, -1.025, -.5);
  group.receiveShadow = true;
  let dead = false;
  return { group, dispose() { if(dead)return;dead=true;group.removeFromParent();geometry.dispose();material.dispose();lease.release(); } };
}
