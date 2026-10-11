import type { Layer } from "./composition";

export function studyLayers(mode: "landing" | "tarot" | "astrology"): Layer[] {
  const room: Layer[] = [
    ["/art/room.webp", 0, 0, 18, 10],
    ["/art/moon-frame.webp", -4.05, 2.65, 1.25, 1.7, 1, { tint: 0xb3a397 }],
    ["/art/plant.webp", -6.95, -2.4, 2.5, 2.5, 1, { tint: 0x686e62 }],
  ];
  const furniture: Layer[] = [
    ["/art/cat-chair.webp", 2.6, -2.0, 2.6, 3.1],
    // The skirt is behind the desk apron; the painted desk and its legs are excluded.
    ["/art/oracle.webp", -3, -2.88, 2.7, 2.64, [0.2, 0.69, 0.8, 1]],
    ["/art/oracle.webp", -3, 1.43, 4.5, 3.35, 0.595],
    ["/art/table.webp", -3, -2.5, 9, 6],
    ["/art/runner.webp", -3.1, -2.4, 1.65, 4],
    ["/art/mat.webp", -3.1, -0.98, 4.5, 1.7],
    ["/art/candle.webp", -4.65, -0.53, 0.8, 1.05],
    ["/art/lamp.webp", -5.2, 0.5, 3, 3, 1, { flipX: true }],
    ["/art/notebook.webp", -0.7, -0.78, 1.45, 0.9],
    ["/art/pen.webp", -0.55, -1.13, 0.95, 0.36],
    ["/art/mug.webp", -5.35, -0.74, 0.8, 0.8],
    ["/art/tray.webp", -1.65, -1.12, 1.5, 0.75],
    ["/art/deck.webp", -1.65, -1.02, 0.85, 0.55],
  ];
  if (mode !== "tarot") {
    furniture.push([mode === "astrology" ? "/art/crystal-active.webp" : "/art/crystal.webp", -3.4, -0.03, 2.85, 2.85]);
  } else {
    furniture.push(["/art/three-cards.webp", -3.5, -1.02, 2.25, 0.8]);
  }
  if (mode === "landing") {
    // Pull the whole consultation area back into the room, keeping all contact points together.
    const contact: Record<string, number> = {
      "lamp": -0.868, "mug": -0.818, "candle": -0.971,
      "crystal": -0.97, "deck": -1.246, "notebook": -1.01,
    };
    return [...room, ...furniture.filter(([url]) => url !== "/art/notebook.webp" && url !== "/art/pen.webp").map(([url, x, y, w, h, crop, appearance]): Layer => {
      const id = url.split("/").pop()!.replace(".webp", "");
      if (id === "candle") x = -0.65;
      else if (id === "mug") { x = -4.45; y = -0.53; }
      else if (id === "crystal") {
        x = -3.1;
        w = h = 1.85;
        y = -0.97 + h * 0.33;
      }
      if (id === "oracle" && typeof crop === "number") y -= 0.635;
      else if (id === "mat" || id === "tray" || id === "pen") {
        y = -1.66 + (y + 1.66) * 0.55;
        h *= 0.55;
      } else if (id in contact) y -= (contact[id] + 1.66) * 0.45;
      return [url, -3 + (x + 3) * 0.78, -3.65 + (y + 4.7) * 0.78, w * 0.78, h * 0.78, crop, appearance];
    })];
  }
  return [...room, ...furniture];
}
