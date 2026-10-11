import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import atlas from "../apps/web/src/features/astrology/atlas.ts";
const { decodeCities, searchCities, loadCities } = atlas;
const root = new URL("../apps/web/public/content/atlas/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.1.json",root)));
const shards = Object.fromEntries(Object.entries(manifest.countries).map(([country,entry]) => [country,JSON.parse(readFileSync(new URL(entry.file,root)))]));
test("licensed atlas preserves explicit city identity, aliases and duplicate regions", () => {
 const kr=decodeCities(shards.KR,"KR"),us=decodeCities(shards.US,"US");
 assert.equal(kr.length,147);assert.equal(us.length,3408);
 for(const text of ["Seoul","서울","Séoùl"]) assert.equal(searchCities(kr,text)[0].id,"1835848");
 for(const text of ["Busan","부산","Pusan"]) assert.equal(searchCities(kr,text)[0].timezone,"Asia/Seoul");
 assert.equal(searchCities(us,"New York")[0].timezone,"America/New_York");
 const duplicate=searchCities(us,"Springfield");assert.ok(duplicate.length>5);assert.ok(new Set(duplicate.map(c=>c.region)).size>5);
 const border=searchCities(us,"Texarkana");assert.deepEqual(new Set(border.map(c=>c.region)),new Set(["Arkansas","Texas"]));
 assert.deepEqual(searchCities(kr,"Missing fictional settlement"),[]);
 assert.deepEqual(searchCities(us,"a"),[]);
 assert.throws(()=>decodeCities({...shards.KR,version:"future"},"KR"),/ATLAS_INVALID/);
 assert.throws(()=>decodeCities({...shards.KR,cities:[shards.KR.cities[0],shards.KR.cities[0]]},"KR"),/ATLAS_INVALID/);
});
test("country loads are verified and reused offline; failed or abandoned loads are not cached", async () => {
 const original=globalThis.fetch;let calls=[];let offline=false;
 globalThis.fetch=async (url)=>{calls.push(url);if(offline)throw Error("offline");return new Response(readFileSync(new URL(String(url).split("/").at(-1),root)));};
 try {
  const abort=new AbortController();abort.abort();await assert.rejects(loadCities("KR",abort.signal),/Aborted/);assert.equal(calls.length,0);
  const kr=await loadCities("KR",new AbortController().signal);assert.equal(calls.length,2);assert.equal(calls.some(x=>x.includes("US.")),false);
  offline=true;assert.equal(await loadCities("KR",new AbortController().signal),kr);assert.equal(calls.length,2);
  await assert.rejects(loadCities("US",new AbortController().signal),/offline/);
  offline=false;const us=await loadCities("US",new AbortController().signal);assert.equal(us.length,3408);
 } finally { globalThis.fetch=original; }
});
