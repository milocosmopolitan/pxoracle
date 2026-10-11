import * as THREE from 'three';
import type { SceneFactory } from '@pxoracle/scene-runtime';
import {createGlobe,type GlobeQuality} from './index';
/** Storybook camera only; all geometry, loading, materials and cleanup are production. */
export function globePreview(angle:'front'|'side'|'rear'|'terrain'='front',quality:GlobeQuality='country'):SceneFactory{
 return async(leases,signal)=>{
  const globe=await createGlobe(leases,signal,{quality}),scene=new THREE.Scene();scene.background=new THREE.Color(0x202a29);scene.add(globe.group);
  const camera=new THREE.PerspectiveCamera(34,1,.05,100);
  const ambient=new THREE.HemisphereLight(0xffedcf,0x32231b,2);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffd7a0,3);key.position.set(-3,5,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xadc7d2,1.3);fill.position.set(4,3,-3);scene.add(fill);
  if(angle==='side')camera.position.set(4.9,2,0);else if(angle==='rear')camera.position.set(0,2,-4.9);else if(angle==='terrain'){camera.position.set(0,1.8,2.7);globe.rotateTo(28,86);globe.update(0,true);}else camera.position.set(0,2,4.9);
  camera.lookAt(0,angle==='terrain'?1.65:1.3,0);
  return {scene,camera,enter(){},exit(){},update(){},resize(w,h){camera.aspect=w/h;camera.updateProjectionMatrix();},dispose(){globe.dispose();scene.clear();}};
 };
}
