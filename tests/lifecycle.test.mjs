import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineClient} from '../packages/engine-client/src/client.ts';
import {SceneRuntime,TextureLeases} from '../packages/scene-runtime/src/index.ts';
import * as THREE from 'three';

test('worker requests correlate out of order and eviction rejects pending work',async()=>{
 const old=globalThis.Worker;const workers=[];
 class FakeWorker {messages=[];terminated=false;constructor(url){this.url=url;workers.push(this);}postMessage(x){this.messages.push(x);}terminate(){this.terminated=true;}}
 globalThis.Worker=FakeWorker;
 try {const c=new EngineClient('tarot');const first=c.request({n:1}),second=c.request({n:2});assert.equal(workers.length,1);const w=workers[0];w.onmessage({data:{version:1,id:2,ok:true,result:'second'}});w.onmessage({data:{version:1,id:1,ok:true,result:'first'}});assert.deepEqual(await Promise.all([first,second]),['first','second']);const pending=c.request({n:3});const rejected=assert.rejects(pending,/ENGINE_EVICTED/);c.dispose();await rejected;assert.ok(w.terminated);const retried=c.request({n:4});assert.equal(workers.length,2);workers[1].onmessage({data:{version:1,id:4,ok:true,result:'new'}});assert.equal(await retried,'new');c.dispose();}finally{globalThis.Worker=old;}
});
test('abandoned scene preparation is disposed and cannot activate over latest intent',async()=>{
 const runtime=Object.create(SceneRuntime.prototype);Object.assign(runtime,{generation:0,abort:null,active:null,stopped:false,leases:{},status(){}});
 let finish;let disposed=0,entered=0;const old={dispose(){disposed++},enter(){throw Error('stale activated')},exit(){}};
 const pending=runtime.navigate(()=>new Promise(resolve=>{finish=resolve}));runtime.cancelPreparation();await runtime.navigate(async()=>({dispose(){},enter(){entered++},exit(){}}));finish(old);await pending;assert.equal(disposed,1);assert.equal(entered,1);
});
test('concurrent shared texture leases release only after their final owner',async()=>{
 const original=THREE.TextureLoader.prototype.loadAsync;let loads=0,disposed=0;
 THREE.TextureLoader.prototype.loadAsync=async()=>{loads++;const t=new THREE.Texture();t.dispose=()=>{disposed++};return t};
 try{const pool=new TextureLeases();const [a,b]=await Promise.all([pool.acquire('/shared'),pool.acquire('/shared')]);assert.equal(loads,1);assert.equal(pool.count,1);a.release();a.release();await Promise.resolve();assert.equal(disposed,0);b.release();await Promise.resolve();assert.equal(disposed,1);assert.equal(pool.count,0);}finally{THREE.TextureLoader.prototype.loadAsync=original;}
});
