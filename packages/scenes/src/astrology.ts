import { composition } from "./composition";
import type { SceneFactory } from "@pxoracle/scene-runtime";
export const createScene: SceneFactory = (leases, signal) =>
  composition(
    leases,
    signal,
    [
      ["/art/room.webp", 0, 0, 18, 10],
      ["/art/crystal-active.webp", -2, 0, 8, 8],
    ],
    "astrology",
  );
