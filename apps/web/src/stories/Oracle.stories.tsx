import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { SceneCanvas } from "../runtime/SceneCanvas";
import { StateProvider, useOracle } from "../state/store";
import Astrology from "../features/Astrology";
import Tarot from "../features/Tarot";
import { ErrorNotice, Loading } from "../features/shared";
import fixture from "../../../../tests/fixtures/engines.json";
import type { Chart, TarotSession, RouteScene } from "@pxoracle/contracts";
const chart = fixture.chart as Chart;
const session = fixture.session as TarotSession;
function Seed({
  feature,
  revealed,
}: {
  feature: "astrology" | "tarot";
  revealed: boolean;
}) {
  const setChart = useOracle((s) => s.setChart),
    setTarot = useOracle((s) => s.setTarot);
  useEffect(() => {
    if (!revealed) return;
    if (feature === "astrology") setChart(chart);
    else {
      const s = structuredClone(session);
      s.selections = [0, 1, 2].map((slot, i) => ({
        slot,
        positionId: ["situation", "examination", "next_action"][i],
        revealed: true,
        card: s.deck[slot],
        meaningRefs: [],
      }));
      s.state = "reading";
      setTarot(s);
    }
  }, [feature, revealed, setChart, setTarot]);
  return null;
}
const mockTarot = {
  create: async () => structuredClone(session),
  select: async (s: TarotSession, slot: number) => {
    const next = structuredClone(s);
    if (
      !next.selections.some((x) => x.slot === slot) &&
      next.selections.length < next.spread
    )
      next.selections.push({
        slot,
        positionId: ["situation", "examination", "next_action"][
          next.selections.length
        ],
        revealed: false,
        card: next.deck[slot],
        meaningRefs: [],
      });
    return next;
  },
  reveal: async (s: TarotSession, index: number) => {
    const next = structuredClone(s);
    next.selections[index].revealed = true;
    if (
      next.selections.length === next.spread &&
      next.selections.every((x) => x.revealed)
    )
      next.state = "reading";
    return next;
  },
  restore: async () => structuredClone(session),
  complete: async (s: TarotSession) => ({ ...s, state: "completed" as const }),
  evict() {},
};
function SceneBridge({route,frozen}:{route:RouteScene;frozen:boolean}){
 const chart=useOracle(s=>s.chart),selectedBody=useOracle(s=>s.selectedBody),tarot=useOracle(s=>s.tarot);
 return <SceneCanvas embedded route={route} frozen={frozen} data={{bodies:chart?.bodies,selectedBody,revealedCount:tarot?.selections.filter(x=>x.revealed).length}}/>;
}
function Harness({
  route = "landing",
  state = "ready",
  width = 1100,
  frozen = true,
}: {
  route: RouteScene;
  state: "ready" | "reading" | "loading" | "error";
  width: number;
  frozen: boolean;
}) {
  const [retried, setRetried] = useState(false);
  useEffect(() => setRetried(false), [state]);
  const shown = retried ? "ready" : state;
  return (
    <StateProvider>
      <div
        style={{
          width,
          maxWidth: "100%",
          height: 800,
          position: "relative",
          overflow: "auto",
        }}
      >
        <p
          style={{
            position: "relative",
            zIndex: 10,
            background: "#4c3f27",
            padding: 10,
          }}
        >
          STORYBOOK · Deterministic mock data · No WASM calculations
        </p>
        <SceneBridge route={route} frozen={frozen} />
        <div style={{ position: "relative", zIndex: 2 }}>
          {shown === "loading" ? (
            <div className="panel">
              <Loading />
            </div>
          ) : shown === "error" ? (
            <div className="panel">
              <ErrorNotice
                code="ENGINE_LOAD_FAILED"
                retry={() => setRetried(true)}
              />
            </div>
          ) : route === "astrology" ? (
            <>
              <Seed feature="astrology" revealed={state === "reading"} />
              <Astrology engine={{ calculate: async () => chart }} />
            </>
          ) : route === "tarot" ? (
            <>
              <Seed feature="tarot" revealed={state === "reading"} />
              <Tarot engine={mockTarot} />
            </>
          ) : (
            <div
              className="panel"
              style={{ maxWidth: 400, margin: "300px 30px 0 auto" }}
            >
              <p className="eyebrow">THE ORACLE’S STUDY</p>
              <h1>Take your time.</h1>
              <p>Production landing scene with owned teardown.</p>
            </div>
          )}
        </div>
      </div>
    </StateProvider>
  );
}
const meta = {
  title: "PXOracle/Scenes",
  component: Harness,
  args: { route: "landing", state: "ready", width: 1100, frozen: true },
  argTypes: {
    route: { control: "select", options: ["landing", "astrology", "tarot"] },
    state: {
      control: "select",
      options: ["ready", "reading", "loading", "error"],
    },
    width: { control: { type: "range", min: 320, max: 1600, step: 10 } },
    frozen: { control: "boolean" },
  },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Landing: Story = {};
export const AstrologyInput: Story = { args: { route: "astrology" } };
export const AstrologyReading: Story = {
  args: { route: "astrology", state: "reading" },
};
export const TarotInput: Story = { args: { route: "tarot" } };
export const TarotReading: Story = {
  args: { route: "tarot", state: "reading" },
};
export const LoadingState: Story = { args: { state: "loading" } };
export const RetryState: Story = { args: { state: "error" } };
export const MobileTarot: Story = {
  globals:{viewport:{value:"mobile390",isRotated:false}},
  args: { route: "tarot", state: "reading", width: 390 },
};
