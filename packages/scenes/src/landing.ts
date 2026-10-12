import * as THREE from "three";
import { composition } from "./composition";
import { studyCrystal, studyLayers } from "./study";
import { createStudyGlobe } from "./study-globe";
import { createStudyTable } from "./study-table";
import { createStudyObjects } from "./study-objects";
import { createCrystalMist } from "./props/crystal-mist";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import type { GlobeView } from "@pxoracle/contracts/globe-view";
import type { LandingView } from "@pxoracle/contracts/landing-view";
export const createScene: SceneFactory = async (leases, signal) => {
  const base = await composition(leases, signal, studyLayers("landing"), "landing", { pitch: 12 });
  const disposers: (() => void)[] = [base.dispose];
  let dead = false, view: GlobeView | undefined, landing: LandingView | undefined, hovered = false, pointing: "globe" | "crystal" | null = null;
  const dispose = () => { if(dead)return; dead=true; disposers.reverse().forEach(fn => fn()); };
  try {
    const globe = await createStudyGlobe(leases, signal, false, "room", "landing");
    disposers.push(globe.dispose);
    base.scene.add(globe.group);
    const desk = await createStudyTable(leases, signal, "landing");
    disposers.push(desk.dispose);
    base.scene.add(desk.group);
    const objects = await createStudyObjects(leases, signal, "landing");
    disposers.push(objects.dispose);
    base.scene.add(objects.group);
    // The crystal stays dormant until the visitor points at it; then mist rises inside the glass.
    const { sphere } = studyCrystal("landing");
    const mist = createCrystalMist(sphere.radius);
    disposers.push(mist.dispose);
    mist.mesh.position.set(sphere.x, sphere.y, sphere.z + 0.02);
    base.scene.add(mist.mesh);
    const ball = new THREE.Sphere(new THREE.Vector3(sphere.x, sphere.y, sphere.z), sphere.radius * 0.95);
    const ray = new THREE.Raycaster();
    const pick = (x: number, y: number) => {
      ray.setFromCamera(new THREE.Vector2(x, y), base.camera);
      if (ray.intersectObject(globe.earth, false).length) return "globe";
      return ray.ray.intersectsSphere(ball) ? "crystal" : null;
    };
    const hover = (active: boolean) => {
      if (active === hovered) return;
      hovered = active;
      landing?.onCrystal?.({ type: "hover", active });
    };
    return { ...base, dispose,
      update(time, data, reduced) {
        view = data.globe;
        landing = data.landing;
        base.update(time,data,reduced);
        mist.update(time, hovered || landing?.crystalLit ? 1 : 0, reduced);
      },
      needsRender() { return mist.bloom !== (hovered || landing?.crystalLit ? 1 : 0); },
      cursor() { return pointing ? "pointer" : ""; },
      pointerLeave() { pointing = null; hover(false); },
      pointer(event) {
        if(dead || signal.aborted)return;
        pointing = pick(event.x, event.y);
        if (event.type === "focus") { hover(pointing === "crystal"); return; }
        if (pointing === "globe") view?.onIntent?.({type:"open"});
        else if (pointing === "crystal") landing?.onCrystal?.({ type: "open" });
      },
    };
  } catch(error) { dispose(); throw error; }
};
