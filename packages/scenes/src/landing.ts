import * as THREE from "three";
import { composition } from "./composition";
import { studyLayers } from "./study";
import { createStudyGlobe } from "./study-globe";
import { createStudyTable } from "./study-table";
import { createStudyObjects } from "./study-objects";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import type { GlobeView } from "@pxoracle/contracts/globe-view";
export const createScene: SceneFactory = async (leases, signal) => {
  const base = await composition(leases, signal, studyLayers("landing"), "landing", { pitch: 12 });
  const disposers: (() => void)[] = [base.dispose];
  let dead = false, view: GlobeView | undefined;
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
    const ray = new THREE.Raycaster();
    return { ...base, dispose,
      update(time, data, reduced) { view = data.globe; base.update(time,data,reduced); },
      pointer(event) {
        if(dead || signal.aborted || event.type !== "select")return;
        ray.setFromCamera(new THREE.Vector2(event.x,event.y), base.camera);
        if(ray.intersectObject(globe.earth,false).length)view?.onIntent?.({type:"open"});
      },
    };
  } catch(error) { dispose(); throw error; }
};
