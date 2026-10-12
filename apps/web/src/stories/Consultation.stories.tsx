import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Chart } from "@pxoracle/contracts";
import type { InterpretationPlan, NatalInput } from "@pxoracle/contracts/natal";
import { StateProvider, useOracle, useOracleStore } from "../state/store";
import { SceneCanvas } from "../runtime/SceneCanvas";
import Astrology from "../features/Astrology";
import { NATAL_KEY } from "../features/astrology/persistence";
import fixtures from "../../../../tests/fixtures/natal.json";

/**
 * Production consultation flow with the real scene, store and components. Storage is a
 * labeled synthetic localStorage seed; chart transport is a mock engine. No WASM loads.
 */
const meta = {
  title: "PXOracle/Consultation",
  parameters: { layout: "fullscreen" },
  decorators: [(Story: React.ComponentType) => <StateProvider><Story /></StateProvider>],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const f = fixtures.find((x) => x.name === "exact")!;
const engine = {
  calculateNatal: async () => ({ chart: f.chart as Chart, facts: f.facts as NatalInput }),
  restoreNatal: async () => ({ chart: f.chart as Chart, facts: f.facts as NatalInput }),
  interpretNatal: async () => f.plan as InterpretationPlan,
};
type Saved = "none" | "current" | "legacy" | "input-only" | "unsupported" | "corrupt" | "unavailable";
function seedStorage(saved: Saved) {
  try {
    for (const key of [NATAL_KEY, "pxoracle.astrology-chart.v1", "pxoracle.astrology.v1"]) localStorage.removeItem(key);
    if (saved === "current")
      localStorage.setItem(NATAL_KEY, JSON.stringify({ schemaVersion: 1, input: f.input, chart: f.chart, plan: f.plan, versions: f.plan.versions, place: { source: "atlas", label: "Seoul, Seoul, South Korea", cityId: "1835848", country: "KR", atlasVersion: "story" }, savedAt: "2026-10-11T00:00:00Z" }));
    if (saved === "unsupported")
      localStorage.setItem(NATAL_KEY, JSON.stringify({ schemaVersion: 1, input: f.input, chart: f.chart, plan: null, versions: { schema: 1 }, place: null, savedAt: "story" }));
    if (saved === "legacy") localStorage.setItem("pxoracle.astrology-chart.v1", JSON.stringify({ schemaVersion: 1, value: { input: f.input, chart: f.chart } }));
    if (saved === "input-only") localStorage.setItem("pxoracle.astrology.v1", JSON.stringify({ schemaVersion: 1, value: f.input }));
    if (saved === "corrupt") localStorage.setItem(NATAL_KEY, "{not json");
  } catch {
    // Storage may be unavailable in the preview; the probe reports that case itself.
  }
}
function Consultation({
  saved = "none",
  frozen = true,
  stage = "hub",
  withChart = false,
}: {
  saved?: Saved;
  frozen?: boolean;
  stage?: "hub" | "greeting" | "horoscopes" | "details" | "review" | "crystal";
  withChart?: boolean;
}) {
  const store = useOracleStore();
  const astrology = useOracle((s) => s.astrologyView);
  const globe = useOracle((s) => s.globeView);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    seedStorage(saved);
    if (saved === "unavailable") {
      const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
      setSeeded(true);
      return () => { if (descriptor) Object.defineProperty(window, "localStorage", descriptor); };
    }
    setSeeded(true);
  }, [saved]);
  useEffect(() => {
    if (!seeded) return;
    const s = store.getState();
    if (withChart || stage === "crystal") {
      s.setChart(f.chart as Chart);
      s.setNatal({ facts: f.facts as NatalInput, plan: f.plan as InterpretationPlan, status: "ready", place: { source: "atlas", label: "Seoul, Seoul, South Korea", cityId: "1835848", country: "KR", atlasVersion: "story" } });
    }
    const seoul = { label: "Seoul, Seoul, South Korea", timezone: "Asia/Seoul", latitude: 37.566, longitude: 126.9784, provenance: { source: "atlas" as const, label: "Seoul, Seoul, South Korea", cityId: "1835848", country: "KR" as const, atlasVersion: "story" } };
    const draft = { date: "2000-01-01", time: "12:00", accuracy: "exact" as const, uncertaintyMinutes: 30 };
    if (stage === "greeting" || stage === "horoscopes") s.navigateConsultation({ type: "service", service: stage === "greeting" ? "natal" : "horoscopes" });
    if (stage === "details") s.navigateConsultation({ type: "use-saved", stage: "details", birthplace: seoul, draft });
    if (stage === "review") s.navigateConsultation({ type: "use-saved", birthplace: seoul, draft });
    if (stage === "crystal") s.navigateConsultation({ type: "open-crystal" });
  }, [seeded, stage, withChart, store]);
  if (!seeded) return <p>Preparing synthetic storage…</p>;
  return (
    <>
      <SceneCanvas route="astrology" frozen={frozen} data={{ astrology, globe }} />
      <Astrology engine={engine} />
      <p style={{ position: "fixed", bottom: 0, left: 12, zIndex: 30, fontSize: 11 }}>
        STORYBOOK · Production consultation · Synthetic saved data: {saved} · Mock chart transport · No WASM
      </p>
    </>
  );
}
export const Hub: Story = { render: () => <Consultation /> };
export const HubWithCurrentChart: Story = { render: () => <Consultation withChart /> };
export const Horoscopes: Story = { render: () => <Consultation stage="horoscopes" /> };
export const NatalNoSave: Story = { render: () => <Consultation stage="greeting" /> };
export const NatalSavedChart: Story = { render: () => <Consultation stage="greeting" saved="current" /> };
export const NatalLegacySave: Story = { render: () => <Consultation stage="greeting" saved="legacy" /> };
export const NatalInputOnlySave: Story = { render: () => <Consultation stage="greeting" saved="input-only" /> };
export const NatalUnsupportedSave: Story = { render: () => <Consultation stage="greeting" saved="unsupported" /> };
export const NatalCorruptSave: Story = { render: () => <Consultation stage="greeting" saved="corrupt" /> };
export const NatalStorageUnavailable: Story = { render: () => <Consultation stage="greeting" saved="unavailable" /> };
export const UnsavedChartResume: Story = { render: () => <Consultation stage="greeting" withChart /> };
export const BirthDetailsAtTable: Story = { render: () => <Consultation stage="details" /> };
export const BirthReview: Story = { render: () => <Consultation stage="review" /> };
export const CrystalWithReturn: Story = { render: () => <Consultation stage="crystal" /> };
export const Mobile: Story = { render: () => <Consultation stage="greeting" saved="current" />, globals: { viewport: { value: "mobile390", isRotated: false } } };
export const Animated: Story = { render: () => <Consultation frozen={false} /> };
/** Live (unfrozen) table with a current chart: "Resume the current chart" plays the lens zoom into the crystal. */
export const CrystalZoomAnimated: Story = { render: () => <Consultation withChart frozen={false} /> };
