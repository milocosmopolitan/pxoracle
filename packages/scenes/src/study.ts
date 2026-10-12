import type { Layer } from "./composition";
import { studyDesk } from "./study-table";

/** Visible bottom edge of each tabletop sprite as a fraction of its image height (alpha bounds). */
const CONTACT = { mug: 0.862, crystal: 0.833, deck: 0.911, tray: 0.805, notebook: 0.762, pen: 0.718 } as const;

export function studyLayers(mode: "landing" | "tarot" | "astrology"): Layer[] {
  const room: Layer[] = [
    ["/art/room.webp", 0, 0, 18, 10],
    ["/art/moon-frame.webp", -4.05, 2.65, 1.25, 1.7, 1, { tint: 0xb3a397 }],
    ["/art/plant.webp", -6.95, -2.4, 2.5, 2.5, 1, { tint: 0x686e62 }],
  ];
  if (mode === "tarot") {
    // The tarot scene repositions these billboards itself and builds its own desk and mat.
    return [
      ...room,
      ["/art/cat-chair.webp", 2.6, -2.0, 2.6, 3.1],
      ["/art/oracle.webp", -3, -2.88, 2.7, 2.64, [0.2, 0.69, 0.8, 1]],
      ["/art/oracle.webp", -3, 1.43, 4.5, 3.35, 0.595],
      ["/art/runner.webp", -3.1, -2.4, 1.65, 4],
      ["/art/three-cards.webp", -3.5, -1.02, 2.25, 0.8],
    ];
  }
  const desk = studyDesk(mode);
  const s = desk.scale;
  // The landing pulls the painted furniture back into the room at 0.78 scale about y≈0.07.
  const fx = (x: number) => -3 + (x + 3) * s;
  const fy = (y: number) => (mode === "landing" ? -3.65 + (y + 4.7) * s : y);
  /** A painted object standing on the real tabletop: its visible bottom edge touches the surface at depth z. */
  const stand = (url: string, x: number, w: number, h: number, contact: number, z: number, extra: Layer[6] = {}): Layer =>
    [url, x, desk.top + h * (contact - 0.5), w, h, 1, { ...extra, z: desk.rear + z * desk.depth }];
  const furniture: Layer[] = [
    ["/art/cat-chair.webp", fx(2.6), fy(-2.0), 2.6 * s, 3.1 * s],
    // The skirt stands behind the real desk; the portrait's forearms meet its rear edge.
    ["/art/oracle.webp", -3, fy(-2.88), 2.7 * s, 2.64 * s, [0.2, 0.69, 0.8, 1]],
    ["/art/oracle.webp", -3, fy(1.43 - (mode === "landing" ? 0.635 : 0.45)), 4.5 * s, 3.35 * s, 0.595],
    // The runner is draped over the real desk by the composition.
    ["/art/runner.webp", -3.1, desk.top, 1.65 * s, 4 * s, 1, { z: desk.front }],
    // The reading mat lies flat on the surface; the crystal stands on it.
    ["/art/mat.webp", mode === "landing" ? -3.08 : -3.1, desk.top + 0.004, 4.35 * s, desk.depth * 0.62, [0.02, 0.248, 0.982, 0.822], { flat: true, z: desk.rear + desk.depth * 0.52 }],
    stand("/art/mug.webp", mode === "landing" ? -4.13 : -5.35, 0.8 * s, 0.8 * s, CONTACT.mug, 0.3),
    stand("/art/tray.webp", mode === "landing" ? -1.95 : -1.65, 1.5 * s, 0.75 * s, CONTACT.tray, 0.66),
    stand("/art/deck.webp", mode === "landing" ? -1.95 : -1.65, 0.85 * s, 0.55 * s, CONTACT.deck, 0.67),
  ];
  if (mode === "astrology") {
    furniture.push(
      stand("/art/notebook.webp", -0.7, 1.45, 0.9, CONTACT.notebook, 0.22),
      stand("/art/pen.webp", -0.55, 0.95, 0.36, CONTACT.pen, 0.3),
    );
  }
  const crystal = mode === "landing" ? 1.85 : 2.85;
  furniture.push(
    stand(mode === "astrology" ? "/art/crystal-active.webp" : "/art/crystal.webp", mode === "landing" ? -3.08 : -3.4, crystal, crystal, CONTACT.crystal, 0.36),
  );
  return [...room, ...furniture];
}
