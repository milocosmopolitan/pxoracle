import { composition } from "./composition";
import type { SceneFactory } from "@pxoracle/scene-runtime";
export const createScene: SceneFactory = (leases, signal) =>
  composition(
    leases,
    signal,
    [
      ["/art/room.webp", 0, 0, 18, 10],
      ["/art/oracle.webp", -3, -0.8, 5, 6.3],
      ["/art/table.webp", -1, -3.1, 16, 6],
      ["/art/mat.webp", -1, -2.3, 10, 4],
    ],
    "tarot",
  );
