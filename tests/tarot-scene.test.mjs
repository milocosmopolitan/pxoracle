import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TextureLeases } from "../packages/scene-runtime/src/index.ts";
import { createScene } from "../packages/scenes/src/tarot.ts";
const fixture = {
  phase: "dealing",
  revision: 1,
  page: 0,
  focus: null,
  index: 0,
  attempt: 0,
  spread: 1,
  cards: [{ slot: 4, reversed: false, revealed: false, face: "/face.png" }],
};
test("hand ownership changes preserve card world position and reveal uses separate axes", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try {
    const pool = new TextureLeases(),
      scene = await createScene(pool, new AbortController().signal);
    scene.resize(1000, 750);
    scene.update(1, { tarot: fixture }, false);
    const card = scene.scene.getObjectByName("tarot-card-12"),
      hand = scene.scene.getObjectByName("handAnchor");
    scene.update(1 + 1.8 * 0.21999, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    const before = card.getWorldPosition(new THREE.Vector3());
    scene.update(1 + 1.8 * 0.22001, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    assert.ok(card.parent === hand);
    assert.ok(
      card.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 0.002,
    );
    scene.update(1 + 1.8 * 0.79999, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    const held = card.getWorldPosition(new THREE.Vector3());
    scene.update(1 + 1.8 * 0.80001, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    assert.ok(card.parent !== hand);
    assert.ok(
      card.getWorldPosition(new THREE.Vector3()).distanceTo(held) < 0.002,
    );
    const reversed = {
      ...fixture,
      revision: 2,
      phase: "reading",
      cards: [{ ...fixture.cards[0], reversed: true, revealed: true }],
    };
    scene.update(4, { tarot: reversed }, true);
    await new Promise((r) => setImmediate(r));
    scene.update(5, { tarot: reversed }, true);
    assert.equal(card.children[0].rotation.y, Math.PI);
    assert.equal(card.children[0].children[0].rotation.z, Math.PI);
    scene.dispose();
    assert.equal(pool.count, 0);
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});
test("late face completion after disposal releases its lease and never acknowledges", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  let finish;
  const events = [];
  THREE.TextureLoader.prototype.loadAsync = (url) =>
    url === "/face.png"
      ? new Promise((resolve) => (finish = resolve))
      : Promise.resolve(new THREE.Texture());
  try {
    const pool = new TextureLeases(),
      abort = new AbortController(),
      scene = await createScene(pool, abort.signal);
    scene.update(
      0,
      {
        tarot: {
          ...fixture,
          phase: "preparing",
          onEvent: (e) => events.push(e),
        },
      },
      true,
    );
    abort.abort();
    scene.dispose();
    finish(new THREE.Texture());
    await new Promise((r) => setImmediate(r));
    assert.equal(pool.count, 0);
    assert.deepEqual(events, []);
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("a late manifest starts the same prepared card without requiring a new phase", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync,
    urls = [],
    events = [];
  THREE.TextureLoader.prototype.loadAsync = async (url) => {
    urls.push(url);
    return new THREE.Texture();
  };
  try {
    const scene = await createScene(
      new TextureLeases(),
      new AbortController().signal,
    );
    const view = {
      ...fixture,
      phase: "preparing",
      cards: [{ ...fixture.cards[0], face: undefined }],
      onEvent: (e) => events.push(e),
    };
    scene.update(0, { tarot: view }, true);
    scene.update(1, { tarot: { ...view, cards: fixture.cards } }, true);
    await new Promise((r) => setImmediate(r));
    assert.equal(urls.filter((x) => x === "/face.png").length, 1);
    assert.ok(events.some((e) => e.type === "ready"));
    scene.dispose();
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});
