import { composition } from "./composition";
import type { SceneFactory } from "@pxoracle/scene-runtime";
export const createScene: SceneFactory = (leases, signal) =>
  composition(
    leases,
    signal,
    [
      ["/art/room.webp", 0, 0, 18, 10],
      ["/art/oracle.webp", -1.8, -0.7, 5.1, 6.5],
      ["/art/table.webp", -1.8, -3.5, 11, 4],
      ["/art/crystal.webp", -4, -1.8, 2.5, 2.5],
      ["/art/deck.webp", 0.3, -2, 1.6, 1.6],
      ["/art/lamp.webp", -6, -0.8, 2.1, 3.2],
    ],
    "landing",
  );
