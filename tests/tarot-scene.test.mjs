import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TextureLeases } from "../packages/scene-runtime/src/index.ts";
import { createScene } from "../packages/scenes/src/tarot.ts";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) =>
  String(url).startsWith("/art/hand-mesh/")
    ? new Response(
        await readFile(new URL("../apps/web/public" + url, import.meta.url)),
      )
    : originalFetch(url, options);
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
      hand = scene.scene.getObjectByName("supportAnchor");
    scene.update(1 + 2.4 * 0.21999, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    const before = card.getWorldPosition(new THREE.Vector3());
    scene.update(1 + 2.4 * 0.22001, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    assert.ok(card.parent === hand);
    assert.ok(
      card.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 0.002,
    );
    scene.update(1 + 2.4 * 0.79999, { tarot: fixture }, false);
    scene.scene.updateMatrixWorld(true);
    const held = card.getWorldPosition(new THREE.Vector3());
    scene.update(1 + 2.4 * 0.80001, { tarot: fixture }, false);
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

test("approach preserves the table and mat transforms and settles before shuffle acknowledgement", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try {
    const scene = await createScene(
      new TextureLeases(),
      new AbortController().signal,
    );
    scene.resize(1100, 800);
    const view = { ...fixture, cards: [], phase: "conversation" };
    scene.update(1, { tarot: view }, false);
    scene.scene.updateMatrixWorld(true);
    const table = scene.scene.getObjectByName("tarot-table"),
      mat = scene.scene.getObjectByName("reading-mat");
    const matrices = [table.matrixWorld.clone(), mat.matrixWorld.clone()];
    const events = [];
    const approach = {
      ...view,
      phase: "approach",
      revision: 2,
      onEvent: (e) => events.push(e),
    };
    scene.update(2, { tarot: approach }, false);
    for (let t = 2.1; t < 4.4; t += 0.1)
      scene.update(t, { tarot: approach }, false);
    await new Promise((r) => setImmediate(r));
    assert.equal(events.length, 0);
    scene.update(4.401, { tarot: approach }, false);
    scene.scene.updateMatrixWorld(true);
    await new Promise((r) => setImmediate(r));
    assert.equal(events[0].type, "done");
    assert.ok(table.matrixWorld.equals(matrices[0]));
    assert.ok(mat.matrixWorld.equals(matrices[1]));
    const settled = scene.camera.position.clone();
    scene.update(
      4.5,
      { tarot: { ...approach, phase: "shuffle", revision: 3 } },
      false,
    );
    assert.ok(scene.camera.position.distanceTo(settled) < 1e-9);
    scene.dispose();
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("every visible slot and spread position is reachable without stretching arms; reveal clears the mat", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try {
    for (const mobile of [false, true]) {
      const scene = await createScene(
        new TextureLeases(),
        new AbortController().signal,
      );
      scene.resize(mobile ? 390 : 1100, mobile ? 500 : 800);
      for (let index = 0; index < 3; index++)
        for (let slot = 0; slot < 12; slot++)
          for (const progress of [0.22, 0.5, 0.79, 0.8]) {
            const view = {
              ...fixture,
              index,
              spread: 3,
              reviewProgress: progress,
              cards: Array.from({ length: index + 1 }, (_, i) => ({
                slot: i === index ? slot : 70 + i,
                revealed: false,
                reversed: false,
              })),
            };
            scene.update(1, { tarot: view }, false);
            for (const side of ["left", "right"])
              assert.ok(
                scene.scene.getObjectByName(`${side}-arm-rig`).userData
                  .reachable,
                `${mobile} ${slot} ${index} ${progress} ${side}`,
              );
          }
      for (let index = 0; index < 3; index++)
        for (const progress of [0.3, 0.5, 0.7]) {
          scene.update(
            2,
            {
              tarot: {
                ...fixture,
                phase: "revealing",
                spread: 3,
                index,
                reviewProgress: progress,
                cards: Array.from({ length: 3 }, (_, slot) => ({
                  slot,
                  revealed: true,
                  reversed: false,
                })),
              },
            },
            true,
          );
          scene.scene.updateMatrixWorld(true);
          const table = scene.scene.getObjectByName("tarot-table");
          const card = scene.scene.getObjectByName(`tarot-card-${12 + index}`);
          const paper = card.children[0].children[0].children[0];
          for (let i = 0; i < paper.geometry.attributes.position.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(
              paper.geometry.attributes.position,
              i,
            );
            paper.localToWorld(point);
            table.worldToLocal(point);
            assert.ok(point.z >= 0.04, "turning edge remains above the mat");
          }
        }
      scene.dispose();
    }
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("continuous choreography never flips a wrist or jumps an elbow between adjacent frames", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  let scene;
  try {
    scene = await createScene(
      new TextureLeases(),
      new AbortController().signal,
    );
    scene.resize(1100, 800);
    let time = 0,
      revision = 0;
    const previous = new Map();
    for (const [phase, frames] of [
      ["conversation", 10],
      ["approach", 73],
      ["shuffle", 109],
      ["fan", 25],
      ["selecting", 10],
      ["dealing", 73],
      ["preparing", 10],
      ["revealing", 79],
      ["reading", 10],
    ]) {
      const view = {
        ...fixture,
        phase,
        revision: ++revision,
        cards: ["dealing", "preparing", "revealing", "reading"].includes(phase)
          ? fixture.cards
          : [],
      };
      for (let frame = 0; frame < frames; frame++) {
        scene.update((time += 1 / 30), { tarot: view }, false);
        for (const side of ["left", "right"]) {
          const rig = scene.scene.getObjectByName(`${side}-arm-rig`);
          const elbow = new THREE.Vector3().fromArray(rig.userData.elbow);
          const wrist = scene.scene
            .getObjectByName(`${side}-wrist`)
            .quaternion.clone();
          const old = previous.get(side);
          if (old) {
            assert.ok(
              wrist.angleTo(old.wrist) < 0.25,
              `${phase} ${frame} ${side} wrist ${wrist.angleTo(old.wrist)}`,
            );
            assert.ok(
              elbow.distanceTo(old.elbow) < 0.55,
              `${phase} ${frame} ${side} elbow ${elbow.distanceTo(old.elbow)}`,
            );
          }
          previous.set(side, { elbow, wrist });
        }
      }
    }
  } finally {
    scene?.dispose();
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("smaller cards stay inside the mat with mobile touch targets and retain their physical size", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  let scene;
  try {
    scene = await createScene(
      new TextureLeases(),
      new AbortController().signal,
    );
    for (const [width, height] of [
      [390, 540],
      [390, 590],
      [1100, 800],
    ]) {
      scene.resize(width, height);
      scene.update(
        1,
        {
          tarot: {
            ...fixture,
            revision: width + height,
            phase: "selecting",
            cards: [],
          },
        },
        true,
      );
      scene.scene.updateMatrixWorld(true);
      const mat = scene.scene.getObjectByName("reading-mat");
      mat.geometry.computeBoundingBox();
      const bounds = mat.geometry.boundingBox;
      for (let i = 0; i < 12; i++) {
        const card = scene.scene.getObjectByName(`tarot-card-${i}`);
        const paper = card.children[0].children[0].children[0];
        const screen = new THREE.Box2();
        for (let v = 0; v < paper.geometry.attributes.position.count; v++) {
          const point = new THREE.Vector3().fromBufferAttribute(
            paper.geometry.attributes.position,
            v,
          );
          paper.localToWorld(point);
          const onMat = mat.worldToLocal(point.clone());
          assert.ok(
            onMat.x > bounds.min.x + 0.15 && onMat.x < bounds.max.x - 0.15,
            "horizontal mat margin",
          );
          assert.ok(
            onMat.y > bounds.min.y + 0.45 && onMat.y < bounds.max.y - 0.45,
            "rear/front mat margin",
          );
          point.project(scene.camera);
          screen.expandByPoint(
            new THREE.Vector2(
              ((point.x + 1) * width) / 2,
              ((1 - point.y) * height) / 2,
            ),
          );
        }
        assert.ok(
          screen.min.x >= 0 &&
            screen.max.x <= width &&
            screen.min.y >= 0 &&
            screen.max.y <= height,
          "selectable card remains in the viewport",
        );
        const size = screen.getSize(new THREE.Vector2());
        assert.ok(
          size.x >= 44 && size.y >= 44,
          `touch target ${width}: ${size.toArray()}`,
        );
        assert.ok(Math.abs(paper.geometry.parameters.width - 0.705) < 1e-6);
        assert.ok(Math.abs(paper.geometry.parameters.height - 1.065) < 1e-6);
      }
      scene.update(
        2,
        {
          tarot: { ...fixture, revision: width + height + 1, phase: "reading" },
        },
        true,
      );
      const selected = scene.scene.getObjectByName("tarot-card-12");
      assert.deepEqual(
        selected.scale.toArray(),
        [1, 1, 1],
        "reading magnifies through the camera, never by growing the card",
      );
    }
  } finally {
    scene?.dispose();
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("portrait shoulder landmarks drive both sleeves, and revealed Mesh clicks inspect the same card", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  let scene;
  try {
    scene = await createScene(
      new TextureLeases(),
      new AbortController().signal,
    );
    scene.resize(1100, 800);
    const shoulders = [];
    for (const phase of ["conversation", "shuffle"]) {
      scene.update(
        1,
        {
          tarot: {
            ...fixture,
            phase,
            revision: shoulders.length + 1,
            cards: [],
            reviewProgress: 0.2,
          },
        },
        true,
      );
      const plate = scene.scene.getObjectByName("oracle-torso");
      for (const [i, side] of ["right", "left"].entries()) {
        const rig = scene.scene.getObjectByName(`${side}-arm-rig`);
        assert.deepEqual(rig.userData.shoulder, plate.userData.shoulders[i]);
        const cuff = scene.scene.getObjectByName(`${side}-rolled-cuff`);
        const joint = scene.scene.getObjectByName(`${side}-cloth-elbow`);
        const sleeve = scene.scene.getObjectByName(`${side}-sleeve`);
        assert.equal(
          cuff.geometry.parameters.openEnded,
          false,
          "the cuff has closed ends, including inside a bent elbow",
        );
        assert.equal(joint.material, sleeve.material);
        assert.ok(
          cuff.position.distanceTo(joint.position) <
            joint.geometry.parameters.radius,
          "cuff overlaps the clothed elbow",
        );
      }
      shoulders.push(plate.userData.shoulders[0]);
    }
    assert.notDeepEqual(
      shoulders[0],
      shoulders[1],
      "elevated portrait never leaves the old shoulder attachment behind",
    );
    const intents = [];
    const view = {
      ...fixture,
      phase: "reading",
      revision: 3,
      spread: 3,
      readingPanel: true,
      cards: [4, 17, 29].map((slot) => ({
        slot,
        revealed: true,
        reversed: false,
        face: `/face-${slot}.png`,
      })),
      onIntent: (e) => intents.push(e),
    };
    scene.update(2, { tarot: view }, true);
    await new Promise((r) => setImmediate(r));
    scene.update(3, { tarot: view }, true);
    scene.scene.updateMatrixWorld(true);
    const rotations = [];
    for (let i = 0; i < 3; i++) {
      const card = scene.scene.getObjectByName(`tarot-card-${12 + i}`);
      rotations.push(card.rotation.z);
      const point = card
        .getWorldPosition(new THREE.Vector3())
        .project(scene.camera);
      scene.pointer({ type: "focus", x: point.x, y: point.y });
      assert.equal(intents.length, i, "hover does not move the reading camera");
      scene.pointer({ type: "select", x: point.x, y: point.y });
      assert.deepEqual(intents[i], {
        type: "inspect",
        slot: view.cards[i].slot,
      });
    }
    assert.ok(rotations.every((a) => Math.abs(a) <= 0.05));
    assert.ok(new Set(rotations).size > 1);
    scene.update(4, { tarot: { ...view, revision: 4 } }, true);
    assert.deepEqual(
      [0, 1, 2].map(
        (i) => scene.scene.getObjectByName(`tarot-card-${12 + i}`).rotation.z,
      ),
      rotations,
      "placement variation remains stable after restore",
    );
  } finally {
    scene?.dispose();
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});
