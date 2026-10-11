import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { globeCountries,globeRegions,geographicVector,vectorGeography } from '../packages/contracts/src/globe-geography.ts';
import { countryAt,ringContains,sampleElevation } from '../packages/scenes/src/globe/geography.ts';
import { reliefGeometry,GLOBE_RADIUS } from '../packages/scenes/src/globe/index.ts';
const data=JSON.parse(fs.readFileSync('apps/web/public/globe/geography.json','utf8'));
const field=new Int16Array(Uint8Array.from(fs.readFileSync('apps/web/public/globe/elevation.i16')).buffer);
test('all 244 GeoNames country IDs are preserved, geometry gaps explicit',()=>{
 const atlas=JSON.parse(fs.readFileSync('content/astrology/atlas/manifest.geonames-world.2026-10-11.json','utf8'));
 assert.equal(globeCountries.length,244);assert.deepEqual(globeCountries.map(c=>c.code).sort(),Object.keys(atlas.countries).sort());
 for(const c of globeCountries)assert.equal(c.geometryStatus==='available',Boolean(data.polygons[c.code]));
 assert.equal(globeRegions.length,7);
 for(const code of ['RU','TR','KZ']){const c=globeCountries.find(c=>c.code===code);assert(c.regions.includes('asia'));assert(c.regions.includes('europe'));}
 assert(globeCountries.find(c=>c.code==='EG').regions.includes('middle-east'));
});
test('canonical frame aligns known GeoNames coordinates with country polygons',()=>{
 for(const [code,lat,lon] of [['GB',51.5074,-.1278],['KR',37.5665,126.978],['RU',55.75,37.6167],['SG',1.29,103.85],['ID',-6.2146,106.8451],['FJ',-17.8,178]]){
  const v=geographicVector(lat,lon);const p=vectorGeography(...v);assert(Math.abs(lat-p.latitude)<1e-10);assert(Math.abs(lon-p.longitude)<1e-10);assert.equal(countryAt(data.polygons,lat,lon),code);
 }
 assert.deepEqual(geographicVector(0,0),[0,0,1]);
});
test('Fiji uses minimal dateline bounds and all national extrema fit country framing',()=>{
 const f=globeCountries.find(c=>c.code==='FJ').focus;assert(f.longitudeSpan<10);
 for(const code of ['RU','FJ','ID','SG','NZ','GL']){
  const c=globeCountries.find(c=>c.code===code);const center=new THREE.Vector3(...geographicVector(c.focus.latitude,c.focus.longitude));
  for(const poly of data.polygons[code])for(const [lon,lat] of poly[0])assert(center.angleTo(new THREE.Vector3(...geographicVector(lat,lon)))*180/Math.PI<=c.focus.angularRadius+.001);
 }
});
test('holes and dateline multipolygons do not select the ocean',()=>{
 const ring=[[170,-10],[-170,-10],[-170,10],[170,10],[170,-10]];
 assert(ringContains(ring,0,179));assert(ringContains(ring,0,-179));assert(!ringContains(ring,0,0));
 assert.equal(countryAt({AA:[[[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]],[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]]},0,0),null);
});
test('pinned elevation gives real Himalaya relief, sea-level floor and a watertight seam',()=>{
 assert(sampleElevation(field,28,86)>3000);assert(sampleElevation(field,0,-140)<0);
 assert.equal(sampleElevation(field,34,-180),sampleElevation(field,34,180));
 const g=reliefGeometry(field),p=g.attributes.position,n=g.attributes.normal;
 let max=0,min=Infinity;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getY(i),p.getZ(i));max=Math.max(max,r);min=Math.min(min,r);assert(p.getX(i)*n.getX(i)+p.getY(i)*n.getY(i)+p.getZ(i)*n.getZ(i)>0);}
 assert(max>GLOBE_RADIUS+.025);assert(min>=GLOBE_RADIUS-1e-6);assert(max<GLOBE_RADIUS+.045);g.dispose();
});
test('retained source and runtime assets match SHA256 manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync('content/astrology/globe/manifest.json','utf8'));
 for(const [base,items] of [['content/astrology/globe/',manifest.sources],['apps/web/public/globe/',manifest.outputs]])for(const item of items){const bytes=fs.readFileSync(base+item.file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);}
});
test('globe failed and abandoned preparation releases late texture leases',async()=>{
 const {createGlobe}=await import('../packages/scenes/src/globe/index.ts');
 for(const mode of ['failure','abort']){
  const controller=new AbortController();let acquired=0,released=0;
  const leases={acquire:async(url)=>{await new Promise(r=>setTimeout(r,url.includes('walnut')?15:1));if(mode==='failure'&&url.includes('parchment'))throw new Error('fixture failure');acquired++;return {texture:new THREE.Texture(),release(){released++;}};}};
  const preparing=createGlobe(leases,controller.signal);if(mode==='abort')controller.abort();
  await assert.rejects(preparing);assert.equal(acquired,released);
 }
});
test('globe independent pivot, replaceable overlays and idempotent resource cleanup',async()=>{
 const {createGlobe}=await import('../packages/scenes/src/globe/index.ts');
 const originalFetch=globalThis.fetch;globalThis.fetch=async(url)=>url.endsWith('.i16')?new Response(field.buffer):Response.json(data);
 let released=0;const leases={acquire:async()=>({texture:new THREE.Texture(),release(){released++;}})};
 try{
  const globe=await createGlobe(leases,new AbortController().signal);const mount=globe.mount.quaternion.clone();
  for(const [latitude,longitude] of [[1.29,103.85],[-17.8,178],[55.75,37.62]]){
   globe.rotateTo(latitude,longitude);globe.update(0,true);
   const world=globe.mount.quaternion.clone().multiply(globe.sphere.quaternion);
   const center=new THREE.Vector3(...geographicVector(latitude,longitude)).applyQuaternion(world);
   const north=new THREE.Vector3(...geographicVector(latitude+.01,longitude)).applyQuaternion(world).sub(center);
   assert(Math.abs(center.x)<1e-9&&Math.abs(center.y)<1e-9&&center.z>.999);assert(north.y>0&&Math.abs(north.x)<1e-9);
  }
  globe.rotateTo(1.29,103.85);globe.update(0,true);assert(globe.mount.quaternion.equals(mount));
  globe.group.updateMatrixWorld(true);const point=new THREE.Vector3(...geographicVector(1.29,103.85,.94));globe.sphere.localToWorld(point);assert.equal(globe.pickCountry(point),'SG');
  globe.highlightCountry('SG');const old=globe.sphere.getObjectByName('selected-country-boundary');assert(old.geometry.attributes.position.count>128);let freed=0;old.geometry.addEventListener('dispose',()=>freed++);
  globe.highlightCountry('RU');assert.equal(freed,1);globe.highlightRegion('middle-east');globe.highlightCountry(null);
  const geos=new Set(),mats=new Set();globe.group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});
  let geoDisposals=0,matDisposals=0;geos.forEach(g=>g.addEventListener('dispose',()=>geoDisposals++));mats.forEach(m=>m.addEventListener('dispose',()=>matDisposals++));
  globe.dispose();globe.dispose();assert.equal(released,4);assert.equal(geoDisposals,geos.size);assert.equal(matDisposals,mats.size);assert.equal(globe.group.children.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('room quality uses real low-resolution relief without country polygon requests',async()=>{
 const {createGlobe}=await import('../packages/scenes/src/globe/index.ts');
 const originalFetch=globalThis.fetch,requested=[];const room=fs.readFileSync('apps/web/public/globe/elevation-room.i16');
 globalThis.fetch=async(url)=>{requested.push(url);assert.equal(url,'/globe/elevation-room.i16');return new Response(room);};
 const leased=[];const leases={acquire:async(url)=>{leased.push(url);return {texture:new THREE.Texture(),release(){}};}};
 try{
  const globe=await createGlobe(leases,new AbortController().signal,{quality:'room'});
  assert.deepEqual(requested,['/globe/elevation-room.i16']);assert(leased.includes('/globe/parchment-room.png'));assert(leased.includes('/globe/relief-bump-room.png'));
  assert.equal(globe.metrics.terrainVertices,7381);assert.equal(globe.metrics.terrainTriangles,14160);
  let max=0;const p=globe.earth.geometry.attributes.position;for(let i=0;i<p.count;i++)max=Math.max(max,Math.hypot(p.getX(i),p.getY(i),p.getZ(i)));assert(max>GLOBE_RADIUS+.02);
  let instanceDisposals=0;globe.group.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>instanceDisposals++);});globe.dispose();globe.dispose();assert.equal(instanceDisposals,1);
 }finally{globalThis.fetch=originalFetch;}
});
