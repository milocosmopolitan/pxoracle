import { composition } from "./composition";
import { studyLayers } from "./study";
import type { SceneFactory } from "@pxoracle/scene-runtime";
export const createScene: SceneFactory = (leases, signal) =>
  composition(leases, signal, studyLayers("astrology"), "astrology");
