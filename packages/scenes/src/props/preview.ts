import * as THREE from "three";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import { createCandle } from "./candle";
import { createLamp } from "./lamp";

export interface LightingPreviewOptions {
  view?: "front" | "side" | "rear" | "above" | "candle" | "candle-side" | "candle-above";
  fixedTime?: number;
  reduced?: boolean;
  lampOn?: boolean;
  candleOn?: boolean;
  shadows?: boolean;
  failAssets?: boolean;
}

/** Isolated inspection scene using the exact production props and runtime asset leases. */
export function lightingPreview(options: LightingPreviewOptions = {}): SceneFactory {
  return async (leases, signal) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171b20);
    const lamp = await createLamp(leases, signal);
    let candle: Awaited<ReturnType<typeof createCandle>>;
    try {
      const source = options.failAssets ? { acquire: async () => { throw new Error("Storybook asset failure injection"); } } : leases;
      candle = await createCandle(source, signal);
    }
    catch (error) { lamp.dispose(); throw error; }
    const geometry = new THREE.BoxGeometry(7, .12, 5);
    const surface = new THREE.MeshStandardMaterial({ color: 0x6f5140, roughness: .82 });
    const table = new THREE.Mesh(geometry, surface);
    table.position.y = -.06;
    table.receiveShadow = true;
    scene.add(table);
    lamp.group.position.set(-.8, 0, 0);
    candle.group.position.set(.9, 0, .7);
    candle.group.scale.setScalar(.8);
    scene.add(lamp.group, candle.group);
    lamp.setShadows(options.shadows !== false);
    lamp.light.visible = options.lampOn !== false;
    lamp.fill.visible = options.lampOn !== false;
    candle.light.visible = options.candleOn !== false;
    const sphereGeometry = new THREE.SphereGeometry(.23, 32, 20);
    const brass = new THREE.MeshStandardMaterial({ color: 0xb78a45, metalness: .72, roughness: .3 });
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xc3b6a1, roughness: .6 });
    const metalSample = new THREE.Mesh(sphereGeometry, brass);
    metalSample.position.set(.35, .23, 1.1);
    const matteSample = new THREE.Mesh(sphereGeometry, ceramic);
    matteSample.position.set(-.35, .23, 1.1);
    metalSample.castShadow = matteSample.castShadow = true;
    metalSample.receiveShadow = matteSample.receiveShadow = true;
    scene.add(metalSample, matteSample, new THREE.HemisphereLight(0xb9c9e0, 0x30251d, .55));
    const windowLight = new THREE.DirectionalLight(0xb9d3ef, .8);
    windowLight.position.set(-4, 6, 3);
    scene.add(windowLight);
    const camera = new THREE.PerspectiveCamera(38, 1, .05, 50);
    const positions = {
      front: [0, 2.4, 7], side: [7, 2.4, 0], rear: [0, 2.4, -7],
      above: [3.3, 6, 3.5], candle: [1.45, 1.03, 2.8],
      "candle-side": [3.1, 1.0, .7], "candle-above": [1.4, 2.7, 1.2],
    } as const;
    camera.position.fromArray(positions[options.view ?? "front"]);
    if (options.view?.startsWith("candle")) camera.lookAt(.9, .45, .7);
    else camera.lookAt(0, 1.25, 0);
    let active = false, disposed = false;
    return {
      scene, camera,
      enter() { active = true; },
      exit() { active = false; },
      resize(width, height) { camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); },
      update(time, _data, reduced) { candle.update(options.fixedTime ?? time, options.reduced ?? reduced, active); },
      render(renderer) {
        // Shadow ownership remains on the persistent runtime renderer; this scene requests one map.
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.render(scene, camera);
      },
      dispose() {
        if (disposed) return;
        disposed = true; active = false;
        candle.dispose(); lamp.dispose();
        geometry.dispose(); sphereGeometry.dispose(); surface.dispose(); brass.dispose(); ceramic.dispose();
        scene.clear();
      },
    };
  };
}
