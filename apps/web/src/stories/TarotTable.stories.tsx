import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SceneCanvas } from "../runtime/SceneCanvas";
import type { TarotView, TarotPhase } from "@pxoracle/contracts";
import manifest from "../../public/art/manifest.json";
function TableStory({
  phase = "dealing",
  reversed = false,
  reduced = false,
  width = 1100,
  three = false,
  failed = false,
}: {
  phase: TarotPhase;
  reversed: boolean;
  reduced: boolean;
  width: number;
  three: boolean;
  failed: boolean;
}) {
  const [revision, setRevision] = useState(1),
    [stage, setStage] = useState(phase),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const count = three ? 3 : 1;
  const view: TarotView = {
    phase: stage,
    revision,
    page: 0,
    focus: 4,
    index: 0,
    attempt: retry,
    spread: count,
    cards: ["major.00", "major.01", "major.02"]
      .slice(
        0,
        ["conversation", "approach", "shuffle", "fan", "selecting"].includes(
          stage,
        )
          ? 0
          : count,
      )
      .map((id, i) => ({
        slot: i + 4,
        revealed: stage === "reading" || stage === "revealing",
        reversed: reversed || i === 1,
        face:
          failed && !retry
            ? "/art/missing-story-card.png"
            : manifest.cards[id as keyof typeof manifest.cards].url,
      })),
    onEvent: (event) => {
      if (event.type === "asset-error") {
        setError(true);
        return;
      }
      const next: Partial<Record<TarotPhase, TarotPhase>> = {
        approach: "shuffle",
        shuffle: "fan",
        fan: "selecting",
        dealing: "preparing",
        preparing: "revealing",
        revealing: "reading",
      };
      if (next[stage]) {
        setStage(next[stage]!);
        setRevision((n) => n + 1);
      }
    },
    onIntent: (event) => {
      if (event.type === "select") {
        setStage("dealing");
        setRevision((n) => n + 1);
      }
    },
  };
  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        height: 800,
        position: "relative",
        overflow: "hidden",
      }}
      className="tarot-story"
    >
      <SceneCanvas
        route="tarot"
        embedded
        frozen={reduced}
        data={{ tarot: view }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 5,
          background: "#14201f",
          padding: 12,
        }}
      >
        <p>STORYBOOK · Synthetic fixed cards · No WASM · {stage}</p>
        <button
          onClick={() => {
            setStage(phase);
            setRevision((n) => n + 1);
          }}
        >
          Replay
        </button>{" "}
        <button
          onClick={() => {
            setStage(stage === "conversation" ? "approach" : "conversation");
            setRevision((n) => n + 1);
          }}
        >
          Conversation / table
        </button>
        {error && (
          <button
            onClick={() => {
              setError(false);
              setRetry((n) => n + 1);
              setRevision((n) => n + 1);
            }}
          >
            Retry same card
          </button>
        )}
      </div>
    </div>
  );
}
const meta = {
  title: "PXOracle/Tarot table",
  component: TableStory,
  args: {
    phase: "dealing",
    reversed: false,
    reduced: false,
    width: 1100,
    three: false,
    failed: false,
  },
} satisfies Meta<typeof TableStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HandPickPlaceFlip: Story = {};
export const CameraTransition: Story = { args: { phase: "conversation" } };
export const Shuffle: Story = { args: { phase: "shuffle" } };
export const Selection: Story = { args: { phase: "selecting" } };
export const Upright: Story = { args: { phase: "preparing" } };
export const Reversed: Story = { args: { phase: "preparing", reversed: true } };
export const ThreeCards: Story = { args: { phase: "reading", three: true } };
export const Mobile: Story = {
  args: { phase: "selecting", width: 390 },
  globals: { viewport: { value: "mobile390", isRotated: false } },
};
export const LoadingFailure: Story = {
  args: { phase: "preparing", failed: true },
};
export const Restored: Story = { args: { phase: "reading", three: true } };
export const ReducedMotion: Story = { args: { reduced: true } };
