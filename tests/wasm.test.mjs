import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
const root = new URL("../", import.meta.url);
const loaded = {};
const baseline = {
  runtime: process.version,
  platform: process.platform,
  engines: {},
};
async function engine(feature) {
  if (loaded[feature]) return loaded[feature];
  const start = performance.now();
  const { default: create } = await import(
    new URL(`apps/web/public/engines/${feature}/engine.mjs`, root)
  );
  const bytes = readFileSync(
    new URL(`apps/web/public/engines/${feature}/engine.wasm`, root),
  );
  const m = await create({ wasmBinary: bytes });
  baseline.engines[feature] = {
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    initializationMs: performance.now() - start,
    imports: WebAssembly.Module.imports(new WebAssembly.Module(bytes)).map(
      (x) => x.module + "." + x.name,
    ),
  };
  loaded[feature] = m;
  return m;
}
async function call(feature, payload) {
  const m = await engine(feature),
    text = JSON.stringify(payload),
    p = m._malloc(m.lengthBytesUTF8(text) + 1);
  let out = 0;
  try {
    m.stringToUTF8(text, p, m.lengthBytesUTF8(text) + 1);
    out = m._px_process(p);
    return JSON.parse(m.UTF8ToString(out));
  } finally {
    m._free(p);
    if (out) m._px_free(out);
  }
}
function native(feature, payload) {
  return JSON.parse(
    execFileSync(
      "cargo",
      [
        "run",
        "--quiet",
        "--locked",
        "-p",
        `pxoracle-${feature}-wasm`,
        "--example",
        "dispatch",
      ],
      {
        cwd: root,
        input: JSON.stringify(payload),
        stdio: ["pipe", "pipe", "pipe"],
      },
    ),
  );
}
function compare(a, b) {
  if (typeof a === "number") {
    assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
    return;
  }
  if (a && typeof a === "object") {
    assert.deepEqual(Object.keys(a), Object.keys(b));
    for (const k of Object.keys(a)) compare(a[k], b[k]);
  } else assert.equal(a, b);
}
const birth = {
  date: "2000-01-01",
  time: "12:00",
  timezone: "UTC",
  latitude: 0,
  longitude: 0,
  accuracy: "exact",
  fold: null,
  uncertaintyMinutes: null,
};
test("native/WASM natal parity over dates, all ten bodies and interval inputs", async () => {
  for (const input of [
    birth,
    {
      ...birth,
      date: "1950-06-30",
      timezone: "Asia/Seoul",
      latitude: 35.18,
      longitude: 129.07,
    },
    {
      ...birth,
      date: "2024-11-03",
      timezone: "America/New_York",
      accuracy: "unknown",
      latitude: 40.71,
      longitude: -74,
    },
    {
      ...birth,
      date: "2099-12-31",
      accuracy: "approximate",
      uncertaintyMinutes: 60,
    },
  ]) {
    const wasm = await call("astrology", input);
    assert.equal(wasm.ok, true);
    compare(wasm.result, native("astrology", input));
  }
});
test("DST gap/fold errors cross the serialization boundary", async () => {
  assert.equal(
    (
      await call("astrology", {
        ...birth,
        date: "2024-03-10",
        time: "02:30",
        timezone: "America/New_York",
      })
    ).error.code,
    "NONEXISTENT_LOCAL_TIME",
  );
  assert.equal(
    (
      await call("astrology", {
        ...birth,
        date: "2024-11-03",
        time: "01:30",
        timezone: "America/New_York",
      })
    ).error.code,
    "AMBIGUOUS_LOCAL_TIME",
  );
});
test("tarot native/WASM vectors, idempotency, actual-result restore", async () => {
  for (const seed of [
    [0, 0],
    [1, 2],
    [4294967295, 4294967295],
  ]) {
    const input = { op: "create", seed, spread: 3, reversalPercent: 50 };
    let s = (await call("tarot", input)).result;
    compare(s, native("tarot", input));
    assert.equal(new Set(s.deck.map((x) => x.cardId)).size, 78);
    for (const slot of [77, 0, 31]) {
      s = (await call("tarot", { op: "select", session: s, slot })).result;
      compare(
        s,
        (await call("tarot", { op: "select", session: s, slot })).result,
      );
    }
    for (let index = 0; index < 3; index++)
      s = (await call("tarot", { op: "reveal", session: s, index })).result;
    assert.equal(s.state, "reading");
    compare(
      s,
      (
        await call("tarot", {
          op: "restore",
          session: JSON.parse(JSON.stringify(s)),
        })
      ).result,
    );
  }
});
test("fixed fixture covers TypeScript/content/art boundary", async () => {
  const chart = (await call("astrology", birth)).result,
    session = (
      await call("tarot", {
        op: "create",
        seed: [1, 2],
        spread: 3,
        reversalPercent: 0,
      })
    ).result;
  const art = JSON.parse(
    readFileSync(new URL("assets/manifests/art.json", root)),
  );
  const content = JSON.parse(
    readFileSync(new URL("content/tarot/en.v1.json", root)),
  );
  for (const c of session.deck) {
    assert.ok(art.cards[c.cardId]);
    assert.ok(content.cards[c.cardId].upright);
    assert.ok(content.cards[c.cardId].reversed);
  }
  mkdirSync(new URL("tests/fixtures/", root), { recursive: true });
  writeFileSync(
    new URL("tests/fixtures/engines.json", root),
    JSON.stringify({ birth, chart, session }, null, 2) + "\n",
  );
});
test("repeated calls free wire allocations and record honest Node baseline", async () => {
  const m = await engine("tarot");
  for (let n = 0; n < 10; n++)
    await call("tarot", { op: "create", seed: [0, n], spread: 1 });
  const before = m.HEAPU8.length,
    start = performance.now();
  for (let n = 0; n < 500; n++)
    await call("tarot", { op: "create", seed: [0, n], spread: 1 });
  assert.equal(m.HEAPU8.length, before);
  baseline.engines.tarot.meanCreateMs = (performance.now() - start) / 500;
  baseline.engines.tarot.heapBytes = before;
  mkdirSync(new URL("docs/validation/", root), { recursive: true });
  writeFileSync(
    new URL("docs/validation/node-wasm-baseline.json", root),
    JSON.stringify(baseline, null, 2) + "\n",
  );
});

test("independent condition-aligned Swiss/Moshier reference positions and angles", async () => {
 const refs=JSON.parse(readFileSync(new URL('tests/fixtures/astronomy-reference.json',root),'utf8'));
 const delta=(a,b)=>Math.abs((a-b+540)%360-180);
 for(const ref of refs.cases){
  const response=await call('astrology',ref.input);assert.equal(response.ok,true);
  const actual=response.result;
  for(const body of actual.bodies){
   const expected=ref.bodies.find(b=>b.id===body.id);
   assert.ok(delta(body.longitude,expected.longitude)<1/60,`${ref.input.date} ${body.id} longitude`);
   assert.ok(Math.abs(body.latitude-expected.latitude)<1/60,`${body.id} latitude`);
   assert.ok(Math.abs(body.speed-expected.speed)<0.001,`${body.id} speed`);
   assert.equal(body.sign,Math.floor(expected.longitude/30));
   assert.equal(body.house,(body.sign-Math.floor(ref.angles.asc/30)+12)%12+1);
  }
  for(const angle of ['asc','mc'])assert.ok(delta(actual.angles[angle],ref.angles[angle])<0.002,angle);
 }
});

test('major aspect orb inclusion and Whole Sign cusp boundaries',async()=>{
 const base=(await call('astrology',birth)).result;
 const orb=base.aspects.find(x=>x.a==='sun'&&x.b==='moon'&&x.kind==='sextile').orb;
 const at=(await call('astrology',{...birth,orbs:[0,orb,0,0,0]})).result;
 const outside=(await call('astrology',{...birth,orbs:[0,orb-1e-7,0,0,0]})).result;
 const sunMoon=a=>a.aspects.some(x=>x.a==='sun'&&x.b==='moon'&&x.kind==='sextile');
 assert.equal(sunMoon(at),true);assert.equal(sunMoon(outside),false);
 let low=0,high=30;
 for(let n=0;n<30;n++){const longitude=(low+high)/2;const chart=(await call('astrology',{...birth,longitude})).result;if(chart.angles.asc<30)low=longitude;else high=longitude;}
 const before=(await call('astrology',{...birth,longitude:low-0.001})).result;
 const after=(await call('astrology',{...birth,longitude:high+0.001})).result;
 assert.equal(before.houses[0],0);assert.equal(after.houses[0],30);
 assert.equal(before.bodies[0].house,10);assert.equal(after.bodies[0].house,9);
});
