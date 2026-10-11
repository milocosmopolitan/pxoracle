import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createArm } from "../packages/scenes/src/tarot-rig.ts";
import {
  frameReview,
  REVIEW_SHOTS,
  TarotCameraDirector,
} from "../packages/scenes/src/tarot-camera.ts";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) =>
  String(url).startsWith("/art/hand-mesh/")
    ? new Response(
        await readFile(new URL("../apps/web/public" + url, import.meta.url)),
      )
    : originalFetch(url, options);

test("real hand meshes have five articulated fingers, stable geometry and owned skeleton cleanup", async () => {
  const geometries = [],
    materials = [],
    cleanups = [];
  const owner = {
    geometry: (g) => geometries.push(g),
    material: (m) => materials.push(m),
    cleanup: (f) => cleanups.push(f),
  };
  const left = await createArm("left", owner, new AbortController().signal),
    right = await createArm("right", owner, new AbortController().signal);
  const original = geometries.map((g) =>
    Array.from(g.attributes.position.array),
  );
  for (const rig of [left, right]) {
    assert.equal(rig.skeleton.bones.length, 25);
    rig.update(new THREE.Vector3(0, 2, 0.5), "rest");
    const wristNode = rig.root.getObjectByName(
      rig === right ? "right-wrist" : "left-wrist",
    );
    const thumb = rig.skeleton.bones.find((b) => b.name === "thumb-tip");
    const thumbX = wristNode.worldToLocal(
      thumb.getWorldPosition(new THREE.Vector3()),
    ).x;
    assert.ok(
      rig === right ? thumbX > 0 : thumbX < 0,
      "thumb points inward when viewed across the table",
    );
    assert.equal(
      rig.skeleton.bones.filter((b) => b.name.endsWith("tip")).length,
      5,
    );
    for (const pose of ["rest", "support", "packet", "pinch", "release"]) {
      rig.update(
        new THREE.Vector3(rig === right ? -0.3 : 0.7, 2, 0.55),
        pose,
        true,
      );
      const elbow = new THREE.Vector3().fromArray(rig.root.userData.elbow),
        wrist = new THREE.Vector3().fromArray(rig.root.userData.wrist);
      assert.ok(Math.abs(elbow.distanceTo(wrist) - rig.length) < 1e-6);
      assert.ok(
        elbow.z < rig.root.userData.shoulder[2] - 0.4,
        "elbow hangs below the shoulder",
      );
      assert.ok(
        rig.skeleton.bones.every((b) =>
          b.quaternion.toArray().every(Number.isFinite),
        ),
      );
    }
    const index = rig.skeleton.bones.find(
      (b) => b.name === "index-finger-phalanx-intermediate",
    );
    rig.update(new THREE.Vector3(0, 2, 0.5), "rest");
    const rest = index.quaternion.clone();
    rig.update(new THREE.Vector3(0, 2, 0.5), "packet");
    assert.ok(index.quaternion.angleTo(rest) > 0.2);
  }
  geometries.forEach((g, i) =>
    assert.deepEqual(Array.from(g.attributes.position.array), original[i]),
  );
  assert.equal(cleanups.length, 2);
  cleanups.forEach((f) => f());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
});

test("four review cameras use the requested elevations and never mutate table anchors", () => {
  const camera = new THREE.PerspectiveCamera();
  for (const shot of ["shuffle", "selection", "reveal", "reading"])
    for (const mobile of [false, true]) {
      frameReview(camera, mobile ? 390 : 1100, mobile ? 700 : 800, shot);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      const angle = THREE.MathUtils.radToDeg(Math.asin(-direction.y));
      assert.ok(
        Math.abs(
          angle - REVIEW_SHOTS[shot][mobile ? "mobileElevation" : "elevation"],
        ) < 1e-8,
      );
      assert.equal(camera.fov, 36);
    }
});

test("aborted model preparation rejects and its registered resources can be released", async () => {
  const abort = new AbortController();
  abort.abort();
  const cleanups = [];
  const owner = {
    geometry: (g) => cleanups.push(() => g.dispose()),
    material: (m) => cleanups.push(() => m.dispose()),
    cleanup: (f) => cleanups.push(f),
  };
  await assert.rejects(createArm("right", owner, abort.signal), /aborted/);
  assert.ok(cleanups.length >= 3);
  cleanups.forEach((f) => f());
});

test("pinch pads meet across the card and all posed skin stays above the tabletop", async () => {
  const disposers = [];
  const owner = {
    geometry: (g) => disposers.push(() => g.dispose()),
    material: (m) => disposers.push(() => m.dispose()),
    cleanup: (f) => disposers.push(f),
  };
  for (const side of ["left", "right"]) {
    const rig = await createArm(side, owner, new AbortController().signal);
    for (const pose of ["rest", "support", "packet", "pinch", "release"])
      for (const x of [-1.65, 0, 1.65]) {
        rig.update(new THREE.Vector3(x, 2, 0.17), pose, true);
        rig.skeleton.update();
        let minimum = Infinity;
        rig.root.traverse((mesh) => {
          if (mesh.isSkinnedMesh)
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
              const v = mesh.getVertexPosition(i, new THREE.Vector3());
              mesh.localToWorld(v);
              rig.root.worldToLocal(v);
              minimum = Math.min(minimum, v.z);
            }
        });
        assert.ok(minimum >= 0.0549, `${side} ${pose} surface ${minimum}`);
        const elbow = new THREE.Vector3().fromArray(rig.root.userData.elbow),
          shoulder = new THREE.Vector3().fromArray(rig.root.userData.shoulder);
        assert.ok(
          side === "right" ? elbow.x < 0 : elbow.x > 0,
          "elbow bends on its anatomical side",
        );
        if (pose === "pinch") {
          const a = rig.skeleton.bones
            .find((b) => b.name === "thumb-tip")
            .getWorldPosition(new THREE.Vector3());
          const b = rig.skeleton.bones
            .find((b) => b.name === "index-finger-tip")
            .getWorldPosition(new THREE.Vector3());
          assert.ok(
            a.distanceTo(b) < 0.105 && a.distanceTo(b) > 0.095,
            "opposed pads straddle a thin card",
          );
        }
      }
  }
  disposers.forEach((f) => f());
});

test("phase camera settles for shuffle and selection; detail is explicit and restore is immediate", () => {
  const camera = new THREE.PerspectiveCamera(),
    director = new TarotCameraDirector();
  const base = {
    phase: "conversation",
    revision: 0,
    page: 0,
    focus: null,
    index: 0,
    attempt: 0,
    spread: 3,
    cards: [],
  };
  const update = (time, patch, reduced = false) =>
    director.update(camera, time, 1100, 800, { ...base, ...patch }, reduced);
  update(0, {});
  const conversation = camera.position.clone();
  update(1, { phase: "approach" });
  assert.ok(camera.position.equals(conversation));
  update(3.4, { phase: "approach" });
  const shuffle = camera.position.clone();
  update(3.5, { phase: "shuffle" });
  update(5, { phase: "shuffle" });
  assert.ok(camera.position.equals(shuffle));
  update(6, { phase: "fan" });
  update(6.8, { phase: "fan" });
  const selection = camera.position.clone();
  update(7, { phase: "selecting", focus: 4, revision: 8 });
  update(20, { phase: "selecting", focus: 9, revision: 9 });
  assert.ok(camera.position.distanceTo(selection) < 1e-8);
  update(21, { phase: "reading" });
  update(22, { phase: "reading" });
  const overview = camera.position.clone();
  update(23, { phase: "reading", readingFocus: 2 });
  update(24, { phase: "reading", readingFocus: 2 });
  assert.ok(camera.position.distanceTo(overview) > 1);
  update(25, { phase: "reading", readingFocus: null }, true);
  assert.ok(camera.position.distanceTo(overview) < 1e-8);
  const restored = new THREE.PerspectiveCamera();
  new TarotCameraDirector().update(
    restored,
    1,
    1100,
    800,
    { ...base, phase: "reading" },
    false,
  );
  assert.ok(restored.position.distanceTo(overview) < 1e-8);
});

test("selective pixels preserve artwork resolution, depth masks and renderer ownership on failure", async () => {
  const { createPixelPresentation } = await import(
    "../packages/scenes/src/tarot-pixels.ts"
  );
  const pass = createPixelPresentation(),
    world = new THREE.Scene(),
    camera = new THREE.Camera();
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  hand.userData.pixelate = true;
  art.material.dispose();
  art.material = hand.material;
  const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  dust.userData.glow = true;
  world.add(art, hand, dust);
  pass.resize(1100, 800);
  const original = hand.material,
    calls = [];
  let target = null;
  const renderer = {
    shadowMap: { enabled: false, autoUpdate: true, type: THREE.BasicShadowMap },
    getPixelRatio: () => 2,
    getRenderTarget: () => target,
    setRenderTarget: (t) => (target = t),
    render(scene) {
      calls.push({
        width: target?.width,
        height: target?.height,
        hand: hand.visible,
        material: hand.material,
        art: art.material,
        dust: dust.visible,
      });
    },
  };
  pass.render(renderer, world, camera);
  assert.equal(calls[0].width, 550);
  assert.equal(calls[0].hand, true);
  assert.equal(calls[1].width, 2200);
  assert.equal(calls[1].height, 1600);
  assert.equal(calls[1].hand, false);
  assert.equal(calls[2].material.color.getHex(), 0xffffff);
  assert.equal(calls[2].art.color.getHex(), 0);
  assert.equal(calls[1].dust, true);
  assert.equal(calls[2].dust, false, "particles must not select the low-resolution pass");
  assert.equal(calls[3].dust, true, "glow is rendered independently of the limb mask");
  assert.equal(dust.visible, true);
  assert.equal(hand.material, original);
  assert.equal(hand.visible, true);
  assert.equal(target, null);
  assert.equal(renderer.shadowMap.enabled, false);
  let n = 0;
  renderer.render = () => {
    if (++n === 3) throw Error("context lost");
  };
  assert.throws(() => pass.render(renderer, world, camera), /context lost/);
  assert.equal(hand.material, original);
  assert.equal(hand.visible, true);
  assert.equal(target, null);
  assert.equal(dust.visible, true, "effect visibility survives a failed mask pass");
  n = 0;
  renderer.render = () => { if (++n === 4) throw Error("glow lost"); };
  assert.throws(() => pass.render(renderer, world, camera), /glow lost/);
  assert.equal(world.background, null);
  assert.equal(hand.material, original);
  assert.equal(dust.visible, true);
  assert.equal(target, null);
  pass.dispose();
  dust.geometry.dispose();
  dust.material.dispose();
  art.geometry.dispose();
  hand.geometry.dispose();
  original.dispose();
});

test("shawl follows pinned shoulders while its hem lags, and reduced motion settles deterministically", async () => {
  const { createShawl } = await import("../packages/scenes/src/tarot-shawl.ts");
  const resources = [];
  const shawl = createShawl(new THREE.Texture(), {
    geometry: x => resources.push(() => x.dispose()),
    material: x => resources.push(() => x.dispose()),
    cleanup: f => resources.push(f),
  });
  const arms = [-1, 1].map(side => ({
    shoulder: new THREE.Vector3(side * 1.25, 5, 2.5),
    elbow: new THREE.Vector3(side * 1.6, 4.8, .4),
    wrist: new THREE.Vector3(side * 1.2, 2.7, .5),
  }));
  shawl.update(arms, 0, true);
  arms.forEach(arm => { arm.shoulder.x += .1; arm.elbow.y -= .25; });
  shawl.update(arms, 1 / 60, false);
  const moving = Array.from(shawl.group.children[0].geometry.attributes.position.array);
  shawl.update(arms, 0, true);
  const settled = Array.from(shawl.group.children[0].geometry.attributes.position.array);
  assert.deepEqual(moving.slice(0, 45), settled.slice(0, 45), "shoulder seam stays attached");
  assert.notDeepEqual(moving.slice(45), settled.slice(45), "free cloth has inertia");
  assert.ok(moving.every(Number.isFinite));
  const front = shawl.group.children[0];
  const lining = front.children.find(child => child.name.endsWith("-lining"));
  const hem = front.children.find(child => child.name.endsWith("-knit-hem"));
  assert.ok(lining && hem, "knit has a separate inner surface and rounded physical hem");
  const outerPoint = new THREE.Vector3().fromBufferAttribute(front.geometry.attributes.position, 120);
  const innerPoint = new THREE.Vector3().fromBufferAttribute(lining.geometry.attributes.position, 120);
  assert.ok(Math.abs(outerPoint.distanceTo(innerPoint) - .056) < 1e-5, "fabric thickness survives deformation");
  assert.ok(Array.from(hem.geometry.attributes.position.array).every(Number.isFinite));
  shawl.update(arms, 1, true);
  assert.deepEqual(Array.from(shawl.group.children[0].geometry.attributes.position.array), settled);
  resources.forEach(dispose => dispose());
});
