"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SceneRuntime,
  type RouteScene,
  type ViewData,
} from "@pxoracle/scene-runtime";
import { useOracle } from "../state/store";
const factories = {
  landing: () => import("@pxoracle/scenes/landing"),
  astrology: () => import("@pxoracle/scenes/astrology"),
  tarot: () => import("@pxoracle/scenes/tarot"),
};
export function SceneCanvas({
  route,
  data = {},
  frozen = false,
  embedded = false,
}: {
  route: RouteScene;
  data?: ViewData;
  frozen?: boolean;
  embedded?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    let r: SceneRuntime;
    try {
      r = new SceneRuntime(canvas.current, setStatus);
      runtime.current = r;
    } catch {
      setStatus(
        "Your browser cannot start WebGL. All reading controls remain available.",
      );
      return;
    }
    return () => {
      r.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    let canceled = false;
    runtime.current?.cancelPreparation();
    factories[route]()
      .then((module) => {
        if (!canceled) return runtime.current?.navigate(module.createScene);
      })
      .catch(() => {
        if (!canceled) setStatus("The scene could not load. Please retry.");
      });
    return () => {
      canceled = true;
    };
  }, [route, retry]);
  useEffect(() => {
    if (runtime.current) {
      runtime.current.data = data;
      runtime.current.frozen = frozen;
    }
  }, [data, frozen]);
  return (
    <div className="scene-host" style={embedded?{position:"absolute"}:undefined}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="scene-shade" />
      {status && (
        <div className="scene-status" role="status">
          {status}
          {status.includes("retry") || status.includes("Retry") ? (
            <button onClick={() => setRetry((x) => x + 1)}>Retry scene</button>
          ) : null}
        </div>
      )}
    </div>
  );
}
export default function SceneHost() {
  const path = usePathname();
  const chart = useOracle((s) => s.chart);
  const selectedBody = useOracle((s) => s.selectedBody);
  const tarot = useOracle((s) => s.tarot);
  const route: RouteScene = path.startsWith("/astrology")
    ? "astrology"
    : path.startsWith("/tarot")
      ? "tarot"
      : "landing";
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  }, [path]);
  return (
    <SceneCanvas
      route={route}
      data={{
        bodies: chart?.bodies,
        selectedBody,
        revealedCount: tarot?.selections.filter((x) => x.revealed).length,
      }}
    />
  );
}
