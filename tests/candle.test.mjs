import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { createCandle, candleSignal, CANDLE_WICK } from "../packages/scenes/src/props/candle.ts";

function assets() {
  const texture = new THREE.Texture();
  let releases = 0;
  return { leases: { acquire: async () => ({ texture, release: () => releases++ }) }, get releases() { return releases; } };
}

test("candle deterministic smooth signal is bounded and steady in reduced motion", () => {
  let previous = candleSignal(0);
  for (let i = 1; i < 20000; i++) {
    const t = i / 240, n = candleSignal(t);
    assert.equal(n, candleSignal(t));
    assert.ok(Math.abs(n) <= 1);
    assert.ok(Math.abs(n - previous) < .04);
    assert.equal(candleSignal(t, true), 0);
    previous = n;
  }
});

test("wick and actual light stay together through prop and parent transforms", async () => {
  const a = assets(), candle = await createCandle(a.leases, new AbortController().signal);
  const parent = new THREE.Group();
  parent.rotation.x = -Math.PI / 2;
  parent.position.set(7, -2, 3);
  parent.add(candle.group);
  candle.group.rotation.y = .8;
  candle.group.scale.setScalar(2);
  parent.updateMatrixWorld(true);
  assert.deepEqual(candle.light.getWorldPosition(new THREE.Vector3()).toArray(), candle.wick.getWorldPosition(new THREE.Vector3()).toArray());
  assert.equal(candle.wick.position.y, CANDLE_WICK.y);
  assert.equal(candle.light.castShadow, false);
  const body = candle.group.getObjectByName("candle-sculpted-wax");
  const flame = candle.group.getObjectByName("candle-single-flame");
  assert.ok(body.isMesh && body.material.isMeshStandardMaterial);
  assert.ok(flame.isSprite);
  assert.notEqual(flame.geometry, new THREE.Sprite().geometry);
  body.geometry.computeBoundingBox();
  const size = body.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.x > .5 && size.z > .5 && size.y > .57);
  assert.ok(body.castShadow && body.receiveShadow);
  assert.notEqual(body.material.map, flame.material.map);
  assert.equal(flame.renderOrder, 15);
  assert.equal(flame.material.depthTest, true);
  assert.notEqual(body.material.customProgramCacheKey(), flame.material.customProgramCacheKey());
  for (const material of [flame.material]) {
    const shader = { vertexShader: "#include <uv_vertex>", fragmentShader: "void main() {\n#include <map_fragment>\n}" };
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /candleFlameMask/);
  }
  candle.dispose();
});

test("candle bounds, inactive pause, reduced motion and idempotent cleanup", async () => {
  const a = assets(), candle = await createCandle(a.leases, new AbortController().signal);
  let geometries = 0, materials = 0;
  const gs = new Set(), ms = new Set(), ts = new Set();
  candle.group.traverse((o) => { if(o.geometry) gs.add(o.geometry); if(o.material) { ms.add(o.material); if(o.material.map?.isDataTexture) ts.add(o.material.map); } });
  let textures = 0;
  gs.forEach(g => g.addEventListener("dispose", () => geometries++));
  ms.forEach(m => m.addEventListener("dispose", () => materials++));
  ts.forEach(t => t.addEventListener("dispose", () => textures++));
  const flame = candle.group.getObjectByName("candle-single-flame");
  for (let t = 0; t < 100; t += .071) {
    candle.update(t);
    assert.ok(candle.light.intensity >= 1.098 && candle.light.intensity <= 1.302);
    assert.ok(Math.abs(flame.material.rotation) <= .065);
  }
  const held = candle.light.intensity;
  candle.update(99999, false, false);
  assert.equal(candle.light.intensity, held);
  candle.update(300, true);
  assert.equal(candle.light.intensity, 1.2);
  assert.equal(flame.material.rotation, 0);
  candle.dispose(); candle.dispose();
  assert.equal(a.releases, 1);
  assert.equal(geometries, 6);
  assert.equal(textures, 2);
  assert.equal(materials, 5);
  candle.update(900);
  assert.equal(candle.light.intensity, 1.2);
});

test("candle abort before acquisition and stale async completion release correctly", async () => {
  const controller = new AbortController(); controller.abort();
  const a = assets();
  await assert.rejects(createCandle(a.leases, controller.signal), { name: "AbortError" });
  assert.equal(a.releases, 0);
  const later = new AbortController();
  let resolve, releases = 0;
  const pending = createCandle({ acquire: () => new Promise((r) => { resolve = r; }) }, later.signal);
  later.abort(); resolve({ texture: new THREE.Texture(), release: () => releases++ });
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(releases, 1);
  await assert.rejects(createCandle({ acquire: async () => { throw new Error("load failed"); } }, new AbortController().signal), /load failed/);
});


test("authored wax and brass maps reproduce the documented pixels", async () => {
  const a = assets(), c = await createCandle(a.leases, new AbortController().signal);
  const expected = {
    "candle-sculpted-wax": "58506b853b04691e0df90f290717c3f6a711fcf3a049a7bf850c15f105d452f2",
    "candle-turned-brass-holder": "693f9abd16f33279204b1a88bd0aad7a6ec02c97301054a884f0254f5e1b3b46",
  };
  for (const [name, digest] of Object.entries(expected)) {
    const mesh = c.group.getObjectByName(name), map = mesh.material.map;
    assert.equal(map.image.width, 128); assert.equal(map.image.height, 128);
    assert.equal(createHash("sha256").update(map.image.data).digest("hex"), digest);
    assert.equal(map.colorSpace, THREE.SRGBColorSpace);
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
  }
  const wax = c.group.getObjectByName("candle-sculpted-wax");
  // Front mid-wall normals point outward, while the recessed well faces upward.
  const normal = wax.geometry.attributes.normal;
  assert.ok(normal.getZ(97 * 15) > .9);
  assert.ok(normal.getY(97 * 42 + 30) > .9);
  c.dispose();
});


test("wax bounds near-field point irradiance without changing lamp spot response", async () => {
  const a = assets(), c = await createCandle(a.leases, new AbortController().signal);
  const wax = c.group.getObjectByName("candle-sculpted-wax").material;
  const shader = { fragmentShader: "#include <lights_pars_begin>" };
  wax.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /getDistanceAttenuation\( max\( lightDistance, 0\.6 \), pointLight.distance, pointLight.decay \)/);
  assert.match(shader.fragmentShader, /getDistanceAttenuation\( lightDistance, spotLight.distance, spotLight.decay \)/);
  assert.equal(c.light.intensity, 1.2);
  assert.equal(wax.emissive.getHex(), 0);
  c.dispose();
});
