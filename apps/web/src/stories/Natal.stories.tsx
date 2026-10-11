import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { BirthInput, Chart } from "@pxoracle/contracts";
import type { InterpretationPlan, NatalInput } from "@pxoracle/contracts/natal";
import type {
  AstrologySelection,
  AstrologyView,
} from "@pxoracle/contracts/astrology-view";
import { StateProvider, useOracleStore, useOracle } from "../state/store";
import { SceneCanvas } from "../runtime/SceneCanvas";
import { NatalReport } from "../features/astrology/Report";
import { BirthForm } from "../features/astrology/BirthForm";
import Astrology from "../features/Astrology";
import fixtures from "../../../../tests/fixtures/natal.json";
import prose from "../../public/content/natal/en.1.json";
import type { NatalContent } from "../features/astrology/content";
const fixture = (name = "exact") => fixtures.find((f) => f.name === name)!;
const meta = {
  title: "PXOracle/Natal reading",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function Report({
  name = "exact",
  mobile = false,
}: {
  name?: string;
  mobile?: boolean;
}) {
  const f = fixture(name);
  const [selection, setSelection] = useState<AstrologySelection>(null);
  return (
    <div
      className="panel natal-panel"
      style={{
        width: mobile ? 370 : 760,
        maxWidth: "100%",
        maxHeight: "none",
        margin: "auto",
      }}
    >
      <p className="eyebrow">SYNTHETIC FIXTURE · NATIVE RUST REPORT</p>
      <p role="status">
        {selection ? JSON.stringify(selection) : "Whole chart"}
      </p>
      <NatalReport
        chart={f.chart as Chart}
        plan={f.plan as InterpretationPlan}
        content={prose as NatalContent}
        onSelect={setSelection}
      />
    </div>
  );
}
function Input({
  error = "",
  initial,
}: {
  error?: string;
  initial?: BirthInput;
}) {
  const [notice, setNotice] = useState("");
  return (
    <div
      className="panel natal-panel"
      style={{
        width: 470,
        maxWidth: "100%",
        maxHeight: "none",
        margin: "auto",
      }}
    >
      <p>STORYBOOK · Local input preview, no calculation submitted.</p>
      <BirthForm
        busy={false}
        error={error}
        initial={initial}
        onSubmit={() =>
          setNotice(
            "Input accepted locally. Production submits it to the calculation Worker.",
          )
        }
      />
      <p role="status">{notice}</p>
    </div>
  );
}
export const CityInput: Story = { render: () => <Input /> };
export const RepeatedClock: Story = {
  render: () => (
    <Input
      error="AMBIGUOUS_LOCAL_TIME"
      initial={{
        ...(fixture().input as BirthInput),
        date: "2021-11-07",
        time: "01:30",
        timezone: "America/New_York",
      }}
    />
  ),
};
export const SkippedClock: Story = {
  render: () => (
    <Input
      error="NONEXISTENT_LOCAL_TIME"
      initial={{
        ...(fixture().input as BirthInput),
        date: "2021-03-14",
        time: "02:30",
        timezone: "America/New_York",
      }}
    />
  ),
};
export const WholeReport: Story = { render: () => <Report /> };
export const Approximate: Story = {
  render: () => <Report name="approximate" />,
};
export const UnknownMoonBoundary: Story = {
  render: () => <Report name="moon-boundary" />,
};
export const Polar: Story = { render: () => <Report name="polar" /> };
export const NoMajorRelationships: Story = {
  render: () => <Report name="no-aspects" />,
};
export const WideOrbs: Story = { render: () => <Report name="wide-orbs" /> };
export const Generational: Story = {
  render: () => <Report name="generational" />,
};
export const MobileReport: Story = {
  render: () => <Report mobile />,
  globals: { viewport: { value: "mobile390", isRotated: false } },
};
export const KeyboardReport: Story = {
  render: () => (
    <>
      <p>
        Tab to a placement summary or “Show in the crystal” and press Enter.
        Selection is announced above the report.
      </p>
      <Report />
    </>
  ),
};

function Camera({
  initial = null,
  entry = false,
  mobile = false,
  reduced = false,
  fixtureName = "exact",
  clustered = false,
}: {
  initial?: AstrologySelection;
  entry?: boolean;
  mobile?: boolean;
  reduced?: boolean;
  fixtureName?: string;
  clustered?: boolean;
}) {
  const f = fixture(fixtureName);
  const [phase, setPhase] = useState<"entry" | "chart">(
      entry ? "entry" : "chart",
    ),
    [selection, setSelection] = useState(initial),
    [revision, setRevision] = useState(0);
  const view: AstrologyView = {
    phase,
    revision,
    bodies: f.chart.bodies.map(({ id, longitude }, index) => ({
      id,
      longitude: clustered ? (359 + index) % 360 : longitude,
    })),
    houses: clustered ? null : f.chart.houses,
    aspects: clustered ? [] : f.chart.aspects,
    selection,
    viewport: { left: 0.04, top: 0.08, width: 0.92, height: 0.72 },
    onSelect: setSelection,
    ...(reduced ? { reviewProgress: 1 } : {}),
  };
  return (
    <div
      className="natal-camera-story"
      style={{
        width: mobile ? 390 : 1000,
        maxWidth: "100%",
        height: mobile ? 720 : 720,
        position: "relative",
      }}
    >
      <SceneCanvas route="astrology" embedded data={{ astrology: view }} />
      <div
        className="panel"
        style={{
          position: "absolute",
          bottom: 0,
          left: 10,
          right: 10,
          padding: 12,
          zIndex: 3,
        }}
      >
        <p>
          {clustered
            ? "Artificial overlap stress fixture"
            : "Synthetic native chart"}{" "}
          · Same crystal anchor ·{" "}
          {reduced ? "Reduced-motion final framing" : "Continuous camera"}
        </p>
        <div className="actions">
          <button
            onClick={() => {
              setPhase("entry");
              setSelection(null);
              setRevision((r) => r + 1);
            }}
          >
            Return to entry
          </button>
          <button
            onClick={() => {
              setPhase("chart");
              setSelection(null);
              setRevision((r) => r + 1);
            }}
          >
            Approach the crystal
          </button>
          <button
            onClick={() => {
              setPhase("chart");
              setSelection({ type: "body", id: "moon" });
            }}
          >
            Moon detail
          </button>
          <button
            disabled={clustered || !f.chart.aspects.length}
            onClick={() => {
              setPhase("chart");
              setSelection({
                type: "aspect",
                a: "sun",
                b: "saturn",
                kind: "trine",
              });
            }}
          >
            Sun–Saturn
          </button>
          <button onClick={() => setSelection(null)}>Whole chart</button>
        </div>
        <p role="status">{selection ? JSON.stringify(selection) : phase}</p>
      </div>
    </div>
  );
}
export const ChartOverview: Story = { render: () => <Camera /> };
export const PlanetDetail: Story = {
  render: () => <Camera initial={{ type: "body", id: "moon" }} />,
};
export const RelationshipDetail: Story = {
  render: () => (
    <Camera
      initial={{ type: "aspect", a: "sun", b: "saturn", kind: "trine" }}
    />
  ),
};
export const CameraSequence: Story = { render: () => <Camera entry /> };
export const MobileCamera: Story = {
  render: () => <Camera mobile />,
  globals: { viewport: { value: "mobile390", isRotated: false } },
};
export const UnknownTimeCamera: Story = {
  render: () => <Camera fixtureName="moon-boundary" />,
};
export const CrowdedMarkers: Story = {
  render: () => <Camera clustered mobile />,
};
export const ReducedMotion: Story = { render: () => <Camera entry reduced /> };

function Seeded({
  failure = false,
  legacy = false,
  unsupported = false,
}: {
  failure?: boolean;
  legacy?: boolean;
  unsupported?: boolean;
}) {
  const store = useOracleStore();
  const f = fixture();
  const view = useOracle((s) => s.astrologyView);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    store.getState().setChart(f.chart as Chart);
    store
      .getState()
      .setNatal({
        facts: f.facts as NatalInput,
        plan:
          failure || legacy || unsupported
            ? null
            : (f.plan as InterpretationPlan),
        status: failure ? "error" : legacy || unsupported ? "idle" : "ready",
        error: failure ? "NATAL_CONTENT_FAILED" : "",
        restored: legacy ? "legacy" : unsupported ? "unsupported" : "current",
      });
    setSeeded(true);
  }, [store, f, failure, legacy, unsupported]);
  const engine = {
    calculateNatal: async () => ({
      chart: f.chart as Chart,
      facts: f.facts as NatalInput,
    }),
    restoreNatal: async () => ({
      chart: f.chart as Chart,
      facts: f.facts as NatalInput,
    }),
    interpretNatal: async () => f.plan as InterpretationPlan,
  };
  if (!seeded) return <p>Preparing synthetic fixture…</p>;
  return (
    <>
      <p
        className="story-fixture-label"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          zIndex: 20,
          fontSize: 10,
        }}
      >
        STORYBOOK · Synthetic chart · Mock interpretation transport
      </p>
      <SceneCanvas route="astrology" data={{ astrology: view }} />
      <Astrology engine={engine} />
    </>
  );
}
export const ErrorAndRetry: Story = {
  render: () => (
    <StateProvider>
      <Seeded failure />
    </StateProvider>
  ),
};
export const LegacySession: Story = {
  render: () => (
    <StateProvider>
      <Seeded legacy />
    </StateProvider>
  ),
};
export const RestoredSession: Story = {
  render: () => (
    <StateProvider>
      <Seeded />
    </StateProvider>
  ),
};
export const UnavailableVersion: Story = {
  render: () => (
    <StateProvider>
      <Seeded unsupported />
    </StateProvider>
  ),
};
