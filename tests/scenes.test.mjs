import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { TextureLeases } from '../packages/scene-runtime/src/index.ts';
import { composition } from '../packages/scenes/src/composition.ts';
import { studyLayers } from '../packages/scenes/src/study.ts';

test('room scenes use manifested art and release shared portrait leases on disposal', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/manifests/art.json', import.meta.url)));
  const urls = new Set(Object.values(manifest.assets).map(asset => asset.url));
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try {
    for (const mode of ['landing', 'tarot', 'astrology']) {
      const layers = studyLayers(mode);
      for (const [url] of layers) assert.ok(urls.has(url), `${mode}: missing provenance for ${url}`);
      const leases = new TextureLeases();
      const view = await composition(leases, new AbortController().signal, layers, mode);
      view.resize(990, 619);
      view.enter();
      view.update(0, {}, true);
      view.resize(390, 560);
      view.update(1, {}, false);
      view.dispose();
      view.dispose();
      assert.equal(leases.count, 0, `${mode}: leaked texture owner`);
    }
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test('abandoning a room while a prop loads releases every acquired texture', async () => {
  const original = THREE.TextureLoader.prototype.loadAsync;
  const controller = new AbortController();
  THREE.TextureLoader.prototype.loadAsync = async (url) => {
    if (url === '/art/table.webp') controller.abort();
    return new THREE.Texture();
  };
  try {
    const leases = new TextureLeases();
    await assert.rejects(composition(leases, controller.signal, studyLayers('landing'), 'landing'), /aborted/);
    assert.equal(leases.count, 0);
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});
