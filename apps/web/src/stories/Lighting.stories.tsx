import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { SceneRuntime } from "@pxoracle/scene-runtime";
import { lightingPreview, type LightingPreviewOptions } from "@pxoracle/scenes/props/preview";

function LightingStory(options: LightingPreviewOptions) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    try { runtime.current = new SceneRuntime(canvas.current, setStatus); }
    catch { setStatus("WebGL unavailable. Inspection requires a WebGL browser."); }
    return () => { runtime.current?.dispose(); runtime.current = null; };
  }, []);
  useEffect(() => {
    const owned = runtime.current;
    if (!owned) return;
    void owned.navigate(lightingPreview({ ...options, failAssets: options.failAssets && retry === 0 }));
    return () => owned.cancelPreparation();
  }, [options.view, options.fixedTime, options.reduced, options.lampOn, options.candleOn, options.shadows, options.failAssets, retry]);
  return <div style={{ height: "100vh", minHeight: 520, background: "#171b20", color: "#f2e2bd" }}>
    <canvas ref={canvas} aria-label="Production lamp and candle inspection" style={{ display: "block", width: "100%", height: "calc(100% - 48px)" }} />
    <p style={{ margin: 0, padding: 10 }}>Production props · lit brass and ceramic samples · {status || "Ready"}
      {status.includes("Retry") && <button onClick={() => setRetry((n) => n + 1)}>Retry assets</button>}
    </p>
  </div>;
}
const meta = {
  title: "Room/Production Lighting", component: LightingStory, parameters: { layout: "fullscreen" },
  args: { view: "front", fixedTime: 2.5, reduced: false, lampOn: true, candleOn: true, shadows: true },
  argTypes: { view: { control: "select", options: ["front", "side", "rear", "above", "candle"] } },
} satisfies Meta<typeof LightingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Front: Story = {};
export const AssetFailureRetry: Story = { args: { failAssets: true } };
export const ShadeOnly: Story = { args: { lampOn: false, candleOn: false } };
export const NoShadows: Story = { args: { shadows: false } };
export const Side: Story = { args: { view: "side" } };
export const Rear: Story = { args: { view: "rear" } };
export const ShadeInterior: Story = { args: { view: "above" } };
export const CandleClose: Story = { args: { view: "candle" } };
export const CandleOnly: Story = { args: { view: "candle", lampOn: false } };
export const CandleAnimated: Story = { args: { view: "candle", fixedTime: undefined, lampOn: false } };
export const Animated: Story = { args: { fixedTime: undefined } };
export const ReducedMotion: Story = { args: { fixedTime: undefined, reduced: true } };
