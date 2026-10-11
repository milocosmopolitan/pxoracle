"use client";
import { useEffect, useRef } from "react";
import { useOracle } from "../state/store";

const frames = ["closed", "ajar", "half", "open", "frame"];
export function DoorEntrance() {
  const phase = useOracle((s) => s.entrance);
  const ready = useOracle((s) => s.sceneReady);
  const setEntrance = useOracle((s) => s.setEntrance);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  useEffect(() => {
    if (phase !== "waiting" || !ready) return;
    let abandoned = false;
    // Decode every authored frame before playback so slow loads cannot flash blank.
    Promise.all(images.current.map((image) => image?.decode())).then(() => {
      if (!abandoned) setEntrance("opening");
    }).catch(() => { if (!abandoned) setEntrance("entered"); });
    return () => { abandoned = true; };
  }, [phase, ready, setEntrance]);
  useEffect(() => {
    if (phase === "entered") return;
    if (phase === "opening" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntrance("entered");
      return;
    }
    const timer = window.setTimeout(() => setEntrance("entered"), phase === "waiting" ? 12000 : 2200);
    return () => window.clearTimeout(timer);
  }, [phase, setEntrance]);
  if (phase === "entered") return null;
  return (
    <div className={`door-entrance door-${phase}`}>
      <div className="door-surround" aria-hidden="true" />
      <div className="door-art" aria-hidden="true">
        {frames.map((frame, i) => (
          <img key={frame} ref={(image) => { images.current[i] = image; }}
            className={`door-art-frame door-art-${frame}`} src={`/art/door/${frame}.webp`}
            alt="" width={720} height={900} loading="eager" />
        ))}
      </div>
      <div className="door-caption">
        <p role="status">{phase === "waiting" ? "A light is on inside. Preparing your room…" : "Come in. The world can wait."}</p>
        <button onClick={() => setEntrance("entered")}>Skip entrance →</button>
      </div>
    </div>
  );
}
