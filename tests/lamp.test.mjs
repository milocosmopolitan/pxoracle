import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLamp, LAMP_SHADOW_SIZE } from '../packages/scenes/src/props/lamp.ts';

const leases = { acquire() { throw new Error('Procedural lamp must not request texture assets'); } };
test('lamp and desk target follow arbitrary table transforms, never camera motion', async () => {
  const lamp = await createLamp(leases, new AbortController().signal);
  const scene = new THREE.Scene(), table = new THREE.Group(); scene.add(table); table.add(lamp.group);
  table.position.set(-3,-1,1); table.rotation.x = -Math.PI / 2; lamp.group.rotation.x = Math.PI / 2;
  scene.updateMatrixWorld(true);
  const before = lamp.light.getWorldPosition(new THREE.Vector3());
  const target = lamp.target.getWorldPosition(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(); scene.add(camera); camera.position.set(13,11,-7); camera.lookAt(0,0,0);
  scene.updateMatrixWorld(true);
  assert.deepEqual(lamp.light.getWorldPosition(new THREE.Vector3()).toArray(), before.toArray());
  assert.deepEqual(lamp.target.getWorldPosition(new THREE.Vector3()).toArray(), target.toArray());
  assert.deepEqual(lamp.bulb.getWorldPosition(new THREE.Vector3()).toArray(), before.toArray());
  assert(before.y > target.y);
  assert.equal(lamp.light.target,lamp.target);
  assert.equal(lamp.light.shadow.mapSize.x,LAMP_SHADOW_SIZE);
  assert.equal(lamp.fill.castShadow,false);
  assert(lamp.fill.intensity < lamp.light.intensity / 4);
  assert.equal(lamp.fill.parent,lamp.bulb);
  lamp.dispose();
});

test('shade has distinct inner lining, closed hems, swept stem and lit surfaces', async () => {
  const lamp = await createLamp(leases, new AbortController().signal);
  for (const name of ['woven-shade-outer','woven-shade-inner','closed-lower-fabric-hem','closed-upper-fabric-hem','swept-curved-bronze-stem','layered-turned-bronze-foot','top-cap']) {
    const mesh = lamp.group.getObjectByName(name);
    assert(mesh?.isMesh, name);
    assert(mesh.material.isMeshStandardMaterial);
    assert(mesh.geometry.attributes.position.count > 64);
    for (const value of mesh.geometry.attributes.position.array) assert(Number.isFinite(value));
  }
  const outer = lamp.group.getObjectByName('woven-shade-outer');
  assert(outer.material.bumpMap);
  assert(outer.material.emissiveIntensity > 0);
  assert.notEqual(outer.material, lamp.group.getObjectByName('woven-shade-inner').material);
  const box = new THREE.Box3().setFromObject(lamp.group);
  assert(Math.abs(box.min.y) < .001);
  assert(box.max.y > 2.8 && box.max.y < 3.1);
  lamp.dispose();
});

test('lamp cleanup disposes every owned GPU resource exactly once, including shadow fallback', async () => {
  const lamp = await createLamp(leases, new AbortController().signal);
  const resources = new Set();
  lamp.group.traverse(obj => {
    if (!obj.isMesh) return;
    resources.add(obj.geometry); resources.add(obj.material);
    for(const value of Object.values(obj.material)) if(value?.isTexture) resources.add(value);
  });
  const counts = new Map([...resources].map(r => [r,0]));
  for(const r of resources) r.addEventListener('dispose', () => counts.set(r,counts.get(r)+1));
  let shadowDisposed = 0;
  lamp.light.shadow.map = { dispose(){ shadowDisposed++; } };
  lamp.setShadows(false); assert.equal(shadowDisposed,1); assert.equal(lamp.light.castShadow,false);
  lamp.setShadows(true); assert.equal(lamp.light.castShadow,true);
  lamp.dispose(); lamp.dispose();
  assert.equal(lamp.group.children.length,0);
  for(const count of counts.values()) assert.equal(count,1);
});

test('pre-aborted lamp preparation creates no resources or requests', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(createLamp(leases,abort.signal),{name:'AbortError'});
});
