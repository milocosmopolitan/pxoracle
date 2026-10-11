import * as THREE from 'three';
import type { TextureLeases } from '@pxoracle/scene-runtime';
import { geographicVector, vectorGeography, globeCountries, globeRegions, type GlobeRegion } from '@pxoracle/contracts/globe-geography';
import { countryAt, sampleElevation, ELEVATION_WIDTH, ELEVATION_HEIGHT, type CountryPolygons } from './geography';

export const GLOBE_RADIUS=.91;
export const GLOBE_CENTER_Y=1.55;
export const RELIEF_METRES_SCALE=.0000045;
export const GLOBE_SEGMENTS={longitude:360,latitude:180} as const;
/** CPU relief is also the raycast surface. Mean sea level is the base sphere. */
export type GlobeQuality='room'|'country';
export function reliefGeometry(elevation:Int16Array,quality:GlobeQuality='country'){
  const segments=quality==='room'?{longitude:120,latitude:60}:GLOBE_SEGMENTS;
  const geometry=new THREE.SphereGeometry(1,segments.longitude,segments.latitude);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const latitude=90-180*(1-uv.getY(i)),longitude=uv.getX(i)*360-180;
    const r=GLOBE_RADIUS+Math.max(0,sampleElevation(elevation,latitude,longitude,quality==='room'?541:ELEVATION_WIDTH,quality==='room'?271:ELEVATION_HEIGHT))*RELIEF_METRES_SCALE;
    p.setXYZ(i,...geographicVector(latitude,longitude,r));
  }
  geometry.computeVertexNormals();
  // Duplicated seam and pole vertices must share normals to avoid a lighting seam.
  const normals=geometry.attributes.normal, stride=segments.longitude+1;
  for(let row=0;row<=segments.latitude;row++){
    const left=row*stride,right=left+stride-1;
    if(row===0||row===segments.latitude){for(let j=0;j<stride;j++)normals.setXYZ(left+j,0,row===0?1:-1,0);}
    else {const normal=new THREE.Vector3(normals.getX(left)+normals.getX(right),normals.getY(left)+normals.getY(right),normals.getZ(left)+normals.getZ(right)).normalize();normals.setXYZ(left,...normal.toArray());normals.setXYZ(right,...normal.toArray());}
  }
  geometry.computeBoundingSphere();
  return geometry;
}
export async function createGlobe(leases:TextureLeases,signal:AbortSignal,options:{quality?:GlobeQuality}={}){
  const quality=options.quality??'country',radialSegments=quality==='room'?48:96;
  const group=new THREE.Group();group.name='antique-globe';
  const mount=new THREE.Group();mount.name='globe-tilted-meridian';mount.position.y=GLOBE_CENTER_Y;mount.rotation.z=-23.4*Math.PI/180;group.add(mount);
  const sphere=new THREE.Group();sphere.name='globe-geographic-pivot';mount.add(sphere);
  const ownedTextures=new Set<THREE.Texture>();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),releases:(()=>void)[]=[];
  let dead=false;const dispose=()=>{if(dead)return;dead=true;group.removeFromParent();group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());releases.forEach(r=>r());};
  const check=()=>{if(signal.aborted||dead)throw new DOMException('Globe preparation canceled','AbortError');};
  const material=(parameters:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(parameters);materials.add(m);return m;};
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=group)=>{geometries.add(g);const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const lathe=(name:string,profile:number[][],m:THREE.Material,parent:THREE.Object3D=group)=>mesh(name,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),radialSegments),m,parent);
  try{
    // Await every acquisition before failure cleanup so a late success cannot leak its lease.
    const loaded=await Promise.allSettled([quality==='room'?'parchment-room.png':'parchment.png',quality==='room'?'relief-bump-room.png':'relief-bump.png','walnut.png','brass-roughness.png'].map(async file=>{const l=await leases.acquire('/globe/'+file);releases.push(l.release);return l.texture;}));
    check();for(const item of loaded)if(item.status==='rejected')throw item.reason;
    const [map,bumpSource,wood,roughSource]=loaded.map(item=>(item as PromiseFulfilledResult<THREE.Texture>).value);
    const bump=bumpSource.clone(),rough=roughSource.clone();for(const t of [bump,rough]){t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;ownedTextures.add(t);}
    const responses=await Promise.all([fetch(quality==='room'?'/globe/elevation-room.i16':'/globe/elevation.i16',{signal}),quality==='country'?fetch('/globe/geography.json',{signal}):Promise.resolve(null)]);
    if(responses.some(r=>r&&!r.ok))throw new Error('Globe geographic assets unavailable');
    const [bytes,geography]=await Promise.all([responses[0]!.arrayBuffer(),responses[1]?.json()??Promise.resolve({polygons:{}})]);check();
    if(bytes.byteLength!==(quality==='room'?541*271:ELEVATION_WIDTH*ELEVATION_HEIGHT)*2)throw new Error('Globe elevation length mismatch');
    const elevation=new Int16Array(bytes);const polygons=geography.polygons as CountryPolygons;
    const brass=material({color:0xb99856,metalness:.76,roughness:.43,roughnessMap:rough});
    const darkBrass=material({color:0x625431,metalness:.65,roughness:.62,roughnessMap:rough});
    const walnut=material({color:0xe5cab1,map:wood,roughness:.38,metalness:.02,bumpMap:wood,bumpScale:.009});
    const parchment=material({map,roughness:.87,metalness:.04,bumpMap:bump,bumpScale:.017});
    const earth=mesh('globe-elevation-surface',reliefGeometry(elevation,quality),parchment,sphere);
    // A turned, multi-bevel profile closes at both ends and meets the meridian saddle.
    lathe('walnut-turned-pedestal',[[0,0],[.43,0],[.49,.015],[.515,.04],[.52,.08],[.505,.12],[.48,.14],[.455,.15],[.45,.18],[.425,.195],[.4,.20],[.385,.225],[.34,.24],[.32,.27],[.26,.28],[.245,.30],[.24,.32],[.19,.335],[.145,.36],[.12,.41],[.115,.46],[.13,.50],[.16,.525],[.16,.55],[.145,.58],[.11,.6],[.095,.64],[.1,.69],[.13,.71],[.15,.735],[.13,.76],[0,.76]],walnut).scale.y=.68;
    for(const [radius,y] of [[.46,.168],[.38,.229],[.16,.54]]){
      const trim=mesh('pedestal-brass-inlay',new THREE.TorusGeometry(radius,.006,8,radialSegments),brass);trim.rotation.x=Math.PI/2;trim.position.y=y*.68;
    }
    // Recessed rectangular meridian with rounded edge beads, rather than an untrimmed torus.
    const shape=new THREE.Shape();shape.absarc(0,0,1.045,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absarc(0,0,.99,0,Math.PI*2,true);shape.holes.push(hole);
    const ring=mesh('engraved-brass-meridian',new THREE.ExtrudeGeometry(shape,{depth:.032,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:2,steps:1,curveSegments:quality==='room'?64:128}),brass,mount);ring.position.z=-.016;
    for(const radius of [.994,1.041]){const bead=mesh('meridian-edge-bead',new THREE.TorusGeometry(radius,.005,6,quality==='room'?80:160),darkBrass,mount);bead.position.z=.024;}
    // Graduations share one draw call and one geometry allocation.
    const tickGeometry=new THREE.BoxGeometry(.0025,.018,.002);geometries.add(tickGeometry);
    const ticks=new THREE.InstancedMesh(tickGeometry,darkBrass,180);ticks.name='meridian-engraved-graduations';mount.add(ticks);
    const transform=new THREE.Object3D();
    for(let i=0;i<180;i++){const a=i*Math.PI/90;transform.position.set(Math.sin(a)*1.017,Math.cos(a)*1.017,.023);transform.rotation.z=-a;transform.scale.y=i%5===0?1.4:.65;transform.updateMatrix();ticks.setMatrixAt(i,transform.matrix);}
    for(const sign of [-1,1]){
      const cap=lathe('axis-bearing-collar',[[0,0],[.055,0],[.06,.016],[.045,.03],[.034,.045],[.034,.07],[.042,.076],[.04,.095],[.025,.11],[.015,.145],[0,.16]],brass,mount);cap.position.y=sign*.90;if(sign<0)cap.rotation.z=Math.PI;
    }
    // Fixed saddle reaches the tilted ring's bottom; geography never moves it.
    const saddle=lathe('meridian-saddle',[[0,0],[.10,0],[.105,.025],[.083,.045],[.065,.10],[.055,.15],[.06,.17],[0,.17]],darkBrass);saddle.position.set(0,.44,0);saddle.scale.y=.55;
    const highlightMaterial=new THREE.LineBasicMaterial({color:0xffdd7e,depthTest:true,transparent:true,opacity:.95});materials.add(highlightMaterial);
    let highlight:THREE.LineSegments|null=null;
    const desired=new THREE.Quaternion();
    function rotateTo(latitude:number,longitude:number){
      // Inverse mount preserves north-up screen framing while only the inner globe moves.
      desired.setFromAxisAngle(new THREE.Vector3(1,0,0),latitude*Math.PI/180);
      desired.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-longitude*Math.PI/180));
      desired.premultiply(mount.quaternion.clone().invert());
    }
    function highlightCountries(codes:string[],halo=false){
      if(highlight){sphere.remove(highlight);geometries.delete(highlight.geometry);highlight.geometry.dispose();highlight=null;}
      const points:number[]=[];
      for(const code of codes)for(const poly of polygons[code]??[])for(const ring of poly)for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i];
        for(const p of [a,b])points.push(...geographicVector(p[1],p[0],GLOBE_RADIUS+Math.max(0,sampleElevation(elevation,p[1],p[0]))*RELIEF_METRES_SCALE+.003));
      }
      if(halo&&codes.length===1){
        const focus=globeCountries.find(c=>c.code===codes[0])?.focus;
        if(focus&&focus.angularRadius<1.5){
          const center=new THREE.Vector3(...geographicVector(focus.latitude,focus.longitude));
          const tangent=new THREE.Vector3(0,1,0).cross(center).normalize(),up=center.clone().cross(tangent).normalize();
          for(let i=0;i<64;i++)for(const step of [i,i+1]){const a=step*Math.PI/32;const v=center.clone().multiplyScalar(GLOBE_RADIUS+.006).addScaledVector(tangent,Math.cos(a)*.029).addScaledVector(up,Math.sin(a)*.029);points.push(...v.toArray());}
        }
      }
      if(!points.length)return;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometries.add(geometry);
      highlight=new THREE.LineSegments(geometry,highlightMaterial);highlight.name='selected-country-boundary';sphere.add(highlight);
    }
    const highlightCountry=(code:string|null)=>highlightCountries(code?[code]:[],true);
    const highlightRegion=(id:GlobeRegion|null)=>highlightCountries(id?globeCountries.filter(c=>c.regions.includes(id)).map(c=>c.code):[]);
    rotateTo(25,20);sphere.quaternion.copy(desired);
    let shadowCastingMeshes=0;group.traverse(object=>{if(object instanceof THREE.Mesh&&object.castShadow)shadowCastingMeshes++;});
    return {group,mount,sphere,earth,center:new THREE.Vector3(0,GLOBE_CENTER_Y,0),dispose,rotateTo,highlightCountry,highlightRegion,
      focusCountry:(code:string)=>globeCountries.find(c=>c.code===code)?.focus??null,
      focusRegion:(id:GlobeRegion)=>globeRegions.find(r=>r.id===id)?.focus??null,
      update:(dt:number,reducedMotion=false)=>{if(dead)return;const moving=sphere.quaternion.angleTo(desired)>.0001;if(reducedMotion||!moving)sphere.quaternion.copy(desired);else sphere.quaternion.slerp(desired,1-Math.exp(-Math.max(0,dt)*6));return moving;},
      pickCountry:(worldPoint:THREE.Vector3)=>{const local=sphere.worldToLocal(worldPoint.clone());const p=vectorGeography(local.x,local.y,local.z);return countryAt(polygons,p.latitude,p.longitude);},
      metrics:{quality,terrainVertices:earth.geometry.attributes.position.count,terrainTriangles:earth.geometry.index!.count/3,elevationBytes:bytes.byteLength,textureCount:4,shadowCastingMeshes},
    };
  }catch(error){dispose();throw error;}
}
export type GlobeAssembly=Awaited<ReturnType<typeof createGlobe>>;
