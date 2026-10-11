"use client";
import { useEffect, useRef, useState } from "react";
import {
  SceneRuntime,
  type RouteScene,
  type ViewData,
} from "@pxoracle/scene-runtime";
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
  onStatus,
}: {
  route: RouteScene;
  data?: ViewData;
  frozen?: boolean;
  embedded?: boolean;
  onStatus?: (status: string) => void;
}) {
  const preparedFor = useRef(route);
  const [preparedRoute, setPreparedRoute] = useState<RouteScene | null>(null);
  const statusCallback = useRef(onStatus);
  statusCallback.current = onStatus;
  const reportStatus = (message: string) => {
    setStatus(message);
    setPreparedRoute(message ? null : preparedFor.current);
    statusCallback.current?.(message);
  };
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const ownership=useRef(0);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    const lease=++ownership.current;
    let r=runtime.current;
    try {
      if(!r){r = new SceneRuntime(canvas.current, reportStatus);runtime.current = r;}
    } catch {
      reportStatus(
        "Your browser cannot start WebGL. All reading controls remain available.",
      );
      return;
    }
    const owned=r;
    return () => {
      // React refresh/StrictMode may immediately reclaim the same connected canvas.
      queueMicrotask(()=>{if(ownership.current===lease){owned.dispose();runtime.current=null;}});
    };
  }, []);
  useEffect(() => {
    let canceled = false;
    if (!runtime.current) return;
    preparedFor.current = route;
    reportStatus("Preparing the room…");
    runtime.current.cancelPreparation();
    factories[route]()
      .then((module) => {
        if (!canceled) return runtime.current?.navigate(module.createScene);
      })
      .catch(() => {
        if (!canceled) reportStatus("The scene could not load. Please retry.");
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
    <>
    <div data-ready={preparedRoute === route && !status} data-route={route} data-table={route === "tarot" && data.tarot && data.tarot.phase !== "conversation" ? "active" : undefined} className="scene-host" style={embedded?{position:"absolute"}:undefined}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="scene-shade" />
    </div>
      {status && (
        <div className="scene-status" role="status">
          {status}
          {status.includes("retry") || status.includes("Retry") ? (
            <button onClick={() => setRetry((x) => x + 1)}>Retry scene</button>
          ) : null}
        </div>
      )}
    </>
  );
}
