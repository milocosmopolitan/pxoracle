import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SceneCanvas } from "../runtime/SceneCanvas";
import type { TarotView, TarotPhase } from "@pxoracle/contracts";
import manifest from "../../public/art/manifest.json";
function TableStory({
  cameraProfile,
  handPose,
  reviewShot,
  reviewProgress,
  phase = "dealing",
  reversed = false,
  reduced = false,
  width = 1100,
  three = false,
  failed = false,
}: {
  cameraProfile?: "A" | "B" | "C";
  handPose?: TarotView["handPose"];
  reviewShot?: TarotView["reviewShot"];
  reviewProgress?: number;
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
    [retry, setRetry] = useState(0),
    [selectedSlot, setSelectedSlot] = useState(4),
    [focusedSlot, setFocusedSlot] = useState(4),
    [readingFocus, setReadingFocus] = useState<number | null>(null);
  const count = three ? 3 : 1;
  const view: TarotView = {
    readingFocus,
    cameraProfile,
    handPose,
    reviewShot,
    reviewProgress,
    phase: stage,
    revision,
    page: 0,
    focus: focusedSlot,
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
        slot: i + selectedSlot,
        revealed: stage === "reading" || stage === "revealing",
        reversed: reversed || i === 1,
        face:
          failed && !retry
            ? "/art/missing-story-card.png"
            : manifest.cards[id as keyof typeof manifest.cards].url,
      })),
    onEvent: (event) => {
      if (reviewShot) return;
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
      if (reviewShot) return;
      if (event.type === "select") {
        setSelectedSlot(event.slot);
        setStage("dealing");
        setRevision((n) => n + 1);
      } else if (event.type === "inspect")
        setReadingFocus(event.slot - selectedSlot);
      else setFocusedSlot(event.slot);
    },
  };
  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        height: "min(800px, 100svh)",
        position: "relative",
        overflow: "hidden",
      }}
      data-review={reviewShot || undefined}
      className="tarot-story"
    >
      <SceneCanvas
        route="tarot"
        embedded
        frozen={reduced || !!reviewShot}
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
        <p>
          STORYBOOK · Synthetic fixed cards · No WASM · {stage}
          {reviewShot ? " · FIXED FRAME FOR REVIEW" : ""}
        </p>
        {stage === "reading" && !reviewShot && (
          <button onClick={() => setReadingFocus(null)}>Show all cards</button>
        )}
        <button
          onClick={() => {
            setReadingFocus(null);
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

export const CameraA: Story = {
  args: { phase: "selecting", cameraProfile: "A" },
};
export const CameraB: Story = {
  args: { phase: "selecting", cameraProfile: "B" },
};
export const CameraC: Story = {
  args: { phase: "selecting", cameraProfile: "C" },
};

export const RestHands: Story = {
  args: { phase: "selecting", handPose: "rest" },
};
export const SupportHands: Story = {
  args: { phase: "selecting", handPose: "support" },
};
export const PacketHands: Story = {
  args: { phase: "selecting", handPose: "packet" },
};
export const PinchHands: Story = {
  args: { phase: "selecting", handPose: "pinch" },
};
export const ReleaseHands: Story = {
  args: { phase: "selecting", handPose: "release" },
};

export const FrameShuffle: Story = {
  args: { phase: "shuffle", reviewShot: "shuffle", reviewProgress: 0.08 },
};
export const FrameSelection: Story = {
  args: { phase: "selecting", reviewShot: "selection", reviewProgress: 1 },
};
export const FrameReveal: Story = {
  args: { phase: "revealing", reviewShot: "reveal", reviewProgress: 0.48 },
};
export const FrameCarry: Story = {
  args: { phase: "dealing", reviewShot: "selection", reviewProgress: 0.5 },
};
export const FrameReading: Story = {
  args: {
    phase: "reading",
    reviewShot: "reading",
    reviewProgress: 1,
    three: true,
  },
};
export const FrameDetail: Story = {
  args: { phase: "reading", reviewShot: "detail", reviewProgress: 1 },
};

export const FullCameraSequence: Story = { args: { phase: "conversation" } };
