/** The landing room's crystal: dormant until the visitor points at it (or focuses the astrology entry). */
export type LandingCrystalIntent = { type: "hover"; active: boolean } | { type: "open" };
export interface LandingView {
  /** Lit by the HTML astrology entry (hover or keyboard focus), independent of the canvas pointer. */
  crystalLit: boolean;
  onCrystal?: (intent: LandingCrystalIntent) => void;
}
