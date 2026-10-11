import * as THREE from "three";

// Physical dimensions stay constant across shuffle, selection and reading.
export const CARD_WIDTH = 0.94 * 0.75;
export const CARD_HEIGHT = 1.42 * 0.75;
export const CARD_THICKNESS = 0.028 * 0.75;
export const CARD_GRIP_Y = 0.6 * 0.75;
export const SPREAD_GAP = 1.0;
export const MAT_WIDTH = 9.4;
export const MAT_DEPTH = 6.0;

export function slotPosition(slot: number, page: number, mobile: boolean) {
  const n = slot - page * 12,
    columns = mobile ? 4 : 6;
  return new THREE.Vector3(
    ((n % columns) - (columns - 1) / 2) * (mobile ? 1.1 : 1.15),
    (mobile ? 1.91 : 1.5) - Math.floor(n / columns) * (mobile ? 1.18 : 1.25),
    0.045,
  );
}

export function spreadPosition(index: number, count: number, mobile: boolean) {
  return new THREE.Vector3(
    (index - (count - 1) / 2) * SPREAD_GAP,
    mobile ? -1.55 : -1.3,
    0.06,
  );
}

/** Stable, subtle placement variation survives restore without touching engine randomness. */
export function readingPlacement(slot: number, index: number) {
  return {
    angle: (((slot * 17 + index * 11) % 13) - 6) * 0.008,
    y: Math.sin(slot * 3.7 + index) * 0.045,
  };
}
