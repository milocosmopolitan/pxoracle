import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { TextureLeases } from '../packages/scene-runtime/src/index.ts';
import { studyCrystal } from '../packages/scenes/src/study.ts';
import { studyDesk } from '../packages/scenes/src/study-table.ts';
import { createStudyObjects } from '../packages/scenes/src/study-objects.ts';
import { createCrystalMist } from '../packages/scenes/src/props/crystal-mist.ts';
import { createScene as createAstrology, CHART_SCALE, TABLE_FOV, CRYSTAL_FOV, ZOOM_DURATION, zoomFov, zoomEase } from '../packages/scenes/src/astrology.ts';
import { createScene as createLanding } from '../packages/scenes/src/landing.ts';

async function withSceneEnvironment(run) {
  const oldFetch = globalThis.fetch, oldDocument = globalThis.document, oldLoad = THREE.TextureLoader.prototype.loadAsync;
  globalThis.fetch = async (url) => new Response(await readFile(new URL('../apps/web/public' + url, import.meta.url)));
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillText() {} }) }) };
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try { await run(); } finally {
    globalThis.fetch = oldFetch; globalThis.document = oldDocument; THREE.TextureLoader.prototype.loadAsync = oldLoad;
  }
}
const bloomOf = (scene) => scene.scene.getObjectByName('crystal-mist').material.uniforms.uBloom.value;

test('astrology: the book and pen sit on the visitor side, the mug behind the crystal, all on the tabletop', async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try {
    const leases = new TextureLeases();
    const objects = await createStudyObjects(leases, new AbortController().signal, 'astrology');
    objects.group.updateMatrixWorld(true);
    const desk = studyDesk('astrology');
    const box = (name) => new THREE.Box3().setFromObject(objects.group.getObjectByName(name));
    for (const name of ['closed-book', 'book-pen', 'mug']) {
      const b = box(name);
      assert.ok(b.min.x >= desk.x - desk.width / 2 && b.max.x <= desk.x + desk.width / 2, `${name} stays within the desk width`);
      assert.ok(b.min.z >= desk.rear && b.max.z <= desk.front, `${name} stays within the desk depth (${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)})`);
    }
    const crystal = studyCrystal('astrology');
    const book = box('closed-book').getCenter(new THREE.Vector3()), mug = box('mug').getCenter(new THREE.Vector3());
    assert.ok(book.z > crystal.z && mug.z < crystal.z, 'the book is in front of the crystal, the mug behind it');
    objects.dispose();
    assert.equal(leases.count, 0);
  } finally { THREE.TextureLoader.prototype.loadAsync = original; }
});

test('the astrology crystal stands between the visitor and the oracle, and the chart fits inside its glass', () => {
  const desk = studyDesk('astrology'), crystal = studyCrystal('astrology');
  assert.ok(crystal.z > desk.rear + desk.depth * 0.5 && crystal.z < desk.front - 0.5, 'brought forward from the oracle\'s hands, still on the desk');
  assert.ok(1.1 * CHART_SCALE <= 0.9 * crystal.sphere.radius + 1e-9, 'the chart\'s outer glyphs stay inside the ball');
  assert.ok(Math.abs(crystal.sphere.y - crystal.y) < crystal.size / 2, 'sphere lies inside the sprite');
});

test('lens zoom interpolates focal length with a quintic ease', () => {
  assert.equal(zoomEase(0), 0);
  assert.equal(zoomEase(1), 1);
  assert.ok(Math.abs(zoomEase(0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(zoomFov(TABLE_FOV, CRYSTAL_FOV, 0) - TABLE_FOV) < 1e-9);
  assert.ok(Math.abs(zoomFov(TABLE_FOV, CRYSTAL_FOV, 1) - CRYSTAL_FOV) < 1e-9);
  let last = TABLE_FOV;
  for (let i = 1; i <= 20; i++) {
    const fov = zoomFov(TABLE_FOV, CRYSTAL_FOV, zoomEase(i / 20));
    assert.ok(fov < last, 'narrows monotonically');
    last = fov;
  }
});

test('crystal mist: dormant costs nothing, blooms smoothly, and snaps under reduced motion', () => {
  const mist = createCrystalMist(0.6);
  mist.update(0, 0, false);
  assert.equal(mist.mesh.visible, false, 'dormant mist is not drawn');
  assert.equal(mist.update(0.1, 1, false), true, 'still blooming');
  const early = mist.bloom;
  assert.ok(early > 0 && early < 0.5);
  for (let t = 0.2; t < 3; t += 0.05) mist.update(t, 1, false);
  assert.equal(mist.bloom, 1);
  assert.equal(mist.mesh.visible, true);
  assert.equal(mist.update(3.1, 0, true), false, 'reduced motion: no animation left to run');
  assert.equal(mist.bloom, 0);
  assert.equal(mist.mesh.visible, false);
  mist.update(3.2, 1, true);
  assert.equal(mist.bloom, 1, 'reduced motion: instant bloom');
  const time = mist.mesh.material.uniforms.uTime.value;
  mist.update(9, 1, true);
  assert.equal(mist.mesh.material.uniforms.uTime.value, time, 'reduced motion: the mist holds still');
  mist.dispose(); mist.dispose();
});

test('astrology: table to crystal is a lens zoom; reduced motion cuts; the chart reads inside the ball', async () => {
  await withSceneEnvironment(async () => {
    const leases = new TextureLeases();
    const scene = await createAstrology(leases, new AbortController().signal);
    try {
      scene.resize(1280, 860); scene.enter();
      const viewport = { left: 0, top: 0.06, width: 0.62, height: 0.88 };
      const room = { phase: 'room', region: null, country: null, revision: 1, viewport };
      const entry = { phase: 'entry', revision: 1, bodies: [], houses: null, aspects: [], selection: null, viewport };
      scene.update(0, { globe: room, astrology: entry }, false);
      assert.equal(scene.camera.fov, TABLE_FOV);
      for (let t = 0.05; t < 2; t += 0.05) scene.update(t, { globe: room, astrology: entry }, false);
      assert.ok(Math.abs(bloomOf(scene) - 0.3) < 1e-6, 'a faint mist at the table');
      const tableDistance = scene.camera.position.distanceTo(scene.scene.getObjectByName('natal-crystal-map').getWorldPosition(new THREE.Vector3()));
      const bodies = [{ id: 'sun', longitude: 280 }, { id: 'moon', longitude: 223 }];
      const chart = { phase: 'chart', revision: 2, bodies, houses: null, aspects: [], selection: null, viewport };
      const crystal = { ...room, phase: 'crystal', revision: 2 };
      scene.update(2, { globe: crystal, astrology: chart }, false);
      scene.update(2 + ZOOM_DURATION / 2, { globe: crystal, astrology: chart }, false);
      const midFov = scene.camera.fov;
      assert.ok(midFov < TABLE_FOV && midFov > CRYSTAL_FOV, `mid-zoom narrows the lens (${midFov.toFixed(2)}°)`);
      assert.equal(scene.needsRender(), true, 'zoom is in progress');
      for (let t = 2 + ZOOM_DURATION / 2; t < 2 + ZOOM_DURATION + 1.5; t += 0.05) scene.update(t, { globe: crystal, astrology: chart }, false);
      assert.ok(Math.abs(scene.camera.fov - CRYSTAL_FOV) < 1e-9, 'ends on the crystal lens');
      assert.ok(Math.abs(bloomOf(scene) - 1) < 1e-6, 'the mist has fully risen');
      const map = scene.scene.getObjectByName('natal-crystal-map');
      const center = map.getWorldPosition(new THREE.Vector3());
      assert.ok(scene.camera.position.distanceTo(center) < tableDistance, 'the camera dollied in as well');
      // Chart extent and ball radius on screen: the ring sits inside the glass and inside the frame.
      scene.scene.updateMatrixWorld(true);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(scene.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(scene.camera.quaternion);
      const sphere = studyCrystal('astrology').sphere;
      const ball = new THREE.Vector3(sphere.x, sphere.y, sphere.z);
      const px = (v) => v.clone().project(scene.camera);
      const ringRadius = 1.1 * CHART_SCALE;
      const ballPx = px(ball.clone().addScaledVector(right, sphere.radius)).x - px(ball).x;
      const ringPx = px(center.clone().addScaledVector(right, ringRadius)).x - px(center).x;
      assert.ok(ringPx < ballPx, 'the ring reads inside the ball');
      for (const dir of [right, up]) for (const sign of [-1, 1]) {
        const p = px(center.clone().addScaledVector(dir, sign * ringRadius));
        assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, 'the whole ring is in frame');
      }
      // Reduced motion: returning to the table is an immediate cut to the table lens.
      scene.update(10, { globe: { ...room, revision: 3 }, astrology: { ...entry, revision: 3 } }, true);
      assert.equal(scene.camera.fov, TABLE_FOV);
      assert.ok(Math.abs(bloomOf(scene) - 0.3) < 1e-6);
      scene.update(10.1, { globe: { ...crystal, revision: 4 }, astrology: { ...chart, revision: 4 } }, true);
      assert.ok(Math.abs(scene.camera.fov - CRYSTAL_FOV) < 1e-9, 'reduced motion cuts straight to the crystal');
      assert.equal(bloomOf(scene), 1);
    } finally {
      scene.dispose(); scene.dispose();
    }
    assert.equal(leases.count, 0);
  });
});

test('landing: the crystal is dormant until hovered or its entry is focused; selecting it opens astrology', async () => {
  await withSceneEnvironment(async () => {
    const leases = new TextureLeases();
    const scene = await createLanding(leases, new AbortController().signal);
    try {
      scene.resize(1280, 860); scene.enter();
      const intents = [];
      const landing = (crystalLit) => ({ crystalLit, onCrystal: (intent) => intents.push(intent) });
      scene.update(0, { landing: landing(false) }, true);
      assert.equal(bloomOf(scene), 0, 'dormant by default');
      assert.equal(scene.scene.getObjectByName('crystal-mist').visible, false);
      scene.scene.updateMatrixWorld(true);
      scene.camera.updateMatrixWorld(true);
      const sphere = studyCrystal('landing').sphere;
      const at = new THREE.Vector3(sphere.x, sphere.y, sphere.z).project(scene.camera);
      scene.pointer({ type: 'focus', x: at.x, y: at.y });
      assert.deepEqual(intents, [{ type: 'hover', active: true }]);
      assert.equal(scene.cursor(), 'pointer');
      scene.update(0.1, { landing: landing(false) }, false);
      assert.ok(bloomOf(scene) > 0 && bloomOf(scene) < 1, 'hover starts the bloom');
      for (let t = 0.15; t < 3; t += 0.05) scene.update(t, { landing: landing(false) }, false);
      assert.equal(bloomOf(scene), 1, 'fully bloomed while hovered');
      scene.pointerLeave();
      assert.deepEqual(intents.at(-1), { type: 'hover', active: false });
      assert.equal(scene.cursor(), '');
      scene.update(3.1, { landing: landing(false) }, true);
      assert.equal(bloomOf(scene), 0, 'reduced motion: dormant again at once');
      scene.update(3.2, { landing: landing(true) }, true);
      assert.equal(bloomOf(scene), 1, 'focusing the astrology entry blooms the crystal');
      scene.pointer({ type: 'focus', x: 0.95, y: -0.95 });
      assert.equal(scene.cursor(), '');
      scene.pointer({ type: 'select', x: at.x, y: at.y });
      assert.deepEqual(intents.at(-1), { type: 'open' });
    } finally {
      scene.dispose(); scene.dispose();
    }
    assert.equal(leases.count, 0);
  });
});
