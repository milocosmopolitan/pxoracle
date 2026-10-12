import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { createGlobe } from "./globe/index";
import { STUDY_ANCHORS, studyAnchors } from "./study-props";

export async function createStudyGlobe(leases: TextureLeases, signal: AbortSignal, tarot = false, quality: "room" | "country" = "country", mode: "landing" | "astrology" = "astrology") {
  const globe = await createGlobe(leases, signal, {quality});
  globe.group.position.fromArray(tarot ? STUDY_ANCHORS.tarotGlobe : studyAnchors(mode).globe);
  globe.group.scale.setScalar(.78);
  return globe;
}
