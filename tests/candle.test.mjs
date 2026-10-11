import test from "node:test";
import assert from "node:assert/strict";
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
  const body = candle.group.getObjectByName("candle-original-body");
  const flame = candle.group.getObjectByName("candle-single-flame");
  assert.equal(body.material.map, flame.material.map);
  assert.equal(flame.renderOrder, 15);
  assert.equal(flame.material.depthTest, true);
  assert.notEqual(body.material.customProgramCacheKey(), flame.material.customProgramCacheKey());
  for (const material of [body.material, flame.material]) {
    const shader = { fragmentShader: "void main() {\n#include <map_fragment>\n}" };
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /candleFlameMask/);
  }
  candle.dispose();
});

test("candle bounds, inactive pause, reduced motion and idempotent cleanup", async () => {
  const a = assets(), candle = await createCandle(a.leases, new AbortController().signal);
  let geometries = 0, materials = 0;
  candle.group.traverse((object) => {
    object.geometry?.addEventListener("dispose", () => geometries++);
    object.material?.addEventListener("dispose", () => materials++);
  });
  const flame = candle.group.getObjectByName("candle-single-flame");
  for (let t = 0; t < 100; t += .071) {
    candle.update(t);
    assert.ok(candle.light.intensity >= 1.098 && candle.light.intensity <= 1.302);
    assert.ok(Math.abs(flame.rotation.z) <= .065);
  }
  const held = candle.light.intensity;
  candle.update(99999, false, false);
  assert.equal(candle.light.intensity, held);
  candle.update(300, true);
  assert.equal(candle.light.intensity, 1.2);
  assert.equal(flame.rotation.z, 0);
  candle.dispose(); candle.dispose();
  assert.equal(a.releases, 1);
  assert.equal(geometries, 2);
  assert.equal(materials, 2);
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
