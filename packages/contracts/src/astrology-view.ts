/** Display facts only: no birthplace, birth record, interpretation pack or engine object. */
export type AstrologySelection =
  | { type: "body"; id: string }
  | { type: "aspect"; a: string; b: string; kind: string }
  | null;
export interface AstrologyView {
  phase: "entry" | "chart";
  revision: number;
  bodies: { id: string; longitude: number }[];
  houses: number[] | null;
  aspects: { a: string; b: string; kind: string }[];
  selection: AstrologySelection;
  /** Normalized viewport excluding the DOM panel. */
  viewport: { left: number; top: number; width: number; height: number };
  onSelect?: (selection: AstrologySelection) => void;
  onSettled?: (revision: number) => void;
  /** Storybook-only camera sample for repeatable intermediate-frame inspection. */
  reviewProgress?: number;
}
