import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import birthplace from '../apps/web/src/state/birthplace.ts';
const { emptyBirthplace, navigateBirthplace, chooseBirthplace } = birthplace;
import { globeShot } from '../packages/scenes/src/globe-camera.ts';
import { globeCountries } from '../packages/contracts/src/globe-geography.ts';
const city = {id:'1880252',country:'SG',name:'Singapore',region:'Singapore',latitude:1.2897,longitude:103.8501,timezone:'Asia/Singapore',aliases:[],atlasVersion:'fixture'};
test('country retargeting invalidates candidates and rejects stale city completions', () => {
  let state = navigateBirthplace(emptyBirthplace(), {type:'region',region:'asia'});
  state = navigateBirthplace(state,{type:'country',country:'SG'});
  const revision=state.revision;
  const candidate=chooseBirthplace(state,city,revision);
  assert.equal(candidate.candidate,city);
  assert.equal(candidate.revision,revision,'city selection cannot move camera');
  const next=navigateBirthplace(candidate,{type:'country',country:'JP'});
  assert.equal(next.candidate,null);
  assert.equal(chooseBirthplace(next,city,revision),next);
  assert.equal(chooseBirthplace(next,city,next.revision),next);
  assert.equal(navigateBirthplace(next,{type:'country',country:'invalid'}),next);
});
test('backtracking preserves browsing membership; cancel does not confirm or delete candidate', () => {
  let state=navigateBirthplace(emptyBirthplace(),{type:'region',region:'asia'});
  state=navigateBirthplace(state,{type:'country',country:'SG'});
  state=chooseBirthplace(state,city,state.revision);
  const canceled=navigateBirthplace(state,{type:'cancel'});
  assert.equal(canceled.candidate,city);
  assert.equal(canceled.phase,'room');
  state=navigateBirthplace(state,{type:'back'});
  assert.equal(state.phase,'region');assert.equal(state.country,null);assert.equal(state.candidate,null);
  state=navigateBirthplace(state,{type:'back'});assert.equal(state.phase,'overview');
  state=navigateBirthplace(state,{type:'back'});assert.equal(state.phase,'room');
});
test('Russia, Fiji, islands and tiny countries frame outside relief at both aspect ratios', () => {
  const center=new THREE.Vector3(0,1.55,0);
  for(const aspect of [.39/ .85, 1.44]) {
    const camera=new THREE.PerspectiveCamera(32,aspect,.05,100);
    for(const code of ['RU','SG','FJ','ID','VA','NZ']) {
      const focus=globeCountries.find(c=>c.code===code).focus;
      const view={phase:'country',country:code,region:null,revision:1,viewport:{left:0,top:0,width:aspect<1?1:.65,height:aspect<1?.4:.8}};
      const shot=globeShot(view,focus,center,camera);
      assert.ok(shot.position.distanceTo(center)>=2.2);
      const after=globeShot({...view},focus,center,camera);
      assert.deepEqual(shot.position.toArray(),after.position.toArray());
      assert.deepEqual(shot.target.toArray(),after.target.toArray());
    }
  }
});
