/** Geographic display only. City coordinates, dates and timezone never enter a scene. */
export type GlobeRegion = "europe" | "asia" | "middle-east" | "africa" | "north-america" | "south-america" | "oceania";
export type GlobePhase = "room" | "overview" | "region" | "country" | "crystal";
export type GlobeIntent =
  | { type: "adjust"; yaw?: number; pitch?: number; zoom?: number }
  | { type: "open" }
  | { type: "region"; region: GlobeRegion | null }
  | { type: "country"; country: string }
  | { type: "back" }
  | { type: "cancel" };
export interface GlobeView {
  phase: GlobePhase;
  region: GlobeRegion | null;
  country: string | null;
  revision: number;
  adjustment?: { yaw?: number; pitch?: number; zoom?: number } | null;
  viewport: { left: number; top: number; width: number; height: number };
  onIntent?: (intent: GlobeIntent) => void;
  onSettled?: (revision: number) => void;
  reviewProgress?: number;
}
