import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import contentModule from "../apps/web/src/features/astrology/content.ts";
import persistence from "../apps/web/src/features/astrology/persistence.ts";
import { layoutMarkers } from "../packages/scenes/src/astrology-layout.ts";
const { validatePlanReferences } = contentModule;
const { readNatal, saveNatal, deleteNatal, inputsMatch, NATAL_KEY } =
  persistence;
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const fixtures = json("tests/fixtures/natal.json");
const semantics = json("apps/web/public/content/natal/semantics.1.json"),
  rules = json("apps/web/public/content/natal/rules.1.json"),
  prose = json("apps/web/public/content/natal/en.1.json");
let mod;
async function call(payload) {
  mod ??= await (
    await import("../apps/web/public/engines/astrology/engine.mjs")
  ).default({
    wasmBinary: readFileSync("apps/web/public/engines/astrology/engine.wasm"),
  });
  const text = JSON.stringify(payload),
    size = mod.lengthBytesUTF8(text) + 1,
    ptr = mod._malloc(size);
  let out;
  try {
    mod.stringToUTF8(text, ptr, size);
    out = mod._px_process(ptr);
    return JSON.parse(mod.UTF8ToString(out));
  } finally {
    mod._free(ptr);
    if (out) mod._px_free(out);
  }
}
test("natal packs reproduce all placements and witnessed pair-specific aspects without embedded prose", () => {
  execFileSync("python3", ["scripts/build-natal-content.py", "--check"]);
  assert.equal(Object.keys(semantics.meanings).length, 468);
  assert.deepEqual(
    new Set(semantics.referenceIds),
    new Set(Object.keys(prose.articles)),
  );
  const witnesses = json(
    "content/astrology/natal/aspect-witnesses.json",
  ).witnesses;
  assert.equal(Object.keys(witnesses).length, 214);
  for (const key of Object.keys(witnesses))
    assert.ok(
      semantics.meanings[key] && !semantics.meanings[key].fallback,
      key,
    );
  assert.deepEqual(
    Object.entries(semantics.meanings)
      .filter(([, x]) => x.fallback)
      .map(([id]) => id)
      .sort(),
    ["aspect.mercury.venus.square", "aspect.neptune.pluto.opposition"],
  );
  const binary = readFileSync("apps/web/public/engines/astrology/engine.wasm");
  for (const [id, article] of Object.entries(prose.articles)) {
    assert.ok(article.body.split(/\s+/).length >= 35, id);
    assert.ok(
      article.constructive.length > 20 && article.question.endsWith("?"),
      id,
    );
    assert.equal(binary.includes(Buffer.from(article.body)), false, id);
    assert.doesNotMatch(
      JSON.stringify(article),
      /TODO|lorem ipsum|your destiny is|you will certainly|guaranteed success/i,
    );
  }
  assert.equal(
    new Set(Object.values(prose.articles).map((x) => x.body)).size,
    Object.keys(prose.articles).length,
  );
});
test("native and WASM natal plans match for exact, sampled, polar, wide/no aspects and historical fixtures", async () => {
  const native = JSON.parse(
    execFileSync(
      "cargo",
      [
        "run",
        "--quiet",
        "--locked",
        "-p",
        "pxoracle-astrology-wasm",
        "--example",
        "natal-fixtures",
      ],
      { encoding: "utf8" },
    ),
  );
  function sameCalculation(a, b, path = "chart") {
    if (typeof a === "number" && typeof b === "number") {
      assert.ok(Math.abs(a - b) < 1e-8, path);
      return;
    }
    if (a && typeof a === "object") {
      assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path);
      for (const key of Object.keys(a))
        sameCalculation(a[key], b[key], `${path}.${key}`);
    } else assert.deepEqual(a, b, path);
  }
  for (let i = 0; i < native.length; i++) {
    assert.equal(native[i].name, fixtures[i].name);
    assert.deepEqual(native[i].input, fixtures[i].input);
    sameCalculation(native[i].chart, fixtures[i].chart);
    sameCalculation(native[i].facts, fixtures[i].facts);
    assert.deepEqual(native[i].plan, fixtures[i].plan);
  }
  assert.equal(
    (await call({ op: "natalInitialize", semantics, rules })).ok,
    true,
  );
  const validate = new Ajv({
    strict: false,
    formats: { double: true, uint32: true },
  }).compile(json("packages/contracts/schemas/natal-plan.json"));
  for (const f of native) {
    const result = await call({ op: "natalInterpret", input: f.facts });
    assert.equal(result.ok, true, f.name);
    assert.deepEqual(result.result, f.plan, f.name);
    assert.ok(validate(result.result));
    validatePlanReferences(result.result, prose);
    const restored = await call({ op: "restoreNatal", chart: f.chart });
    assert.equal(restored.ok, true, f.name);
    assert.equal(restored.result.facts.certainty, f.facts.certainty);
    restored.result.facts.bodies.forEach((b, i) =>
      assert.ok(Math.abs(b.longitude - f.facts.bodies[i].longitude) < 1e-8),
    );
    const calculated = await call({ op: "calculateNatal", input: f.input });
    assert.equal(calculated.ok, true, f.name);
    f.chart.bodies.forEach((b, i) =>
      assert.ok(
        Math.abs(calculated.result.chart.bodies[i].longitude - b.longitude) <
          1e-8,
      ),
    );
  }
  const boundary = native.find((f) => f.name === "moon-boundary");
  assert.ok(boundary.plan.distribution.ambiguousBodies.includes("moon"));
  assert.deepEqual(boundary.plan.distribution.exactElements, [0, 0, 0, 0]);
  assert.equal(boundary.plan.themes.length, 0);
});
test("natal wire rejects private fields, unsupported packs and inconsistent saved facts", async () => {
  await call({ op: "natalInitialize", semantics, rules });
  for (const mutate of [
    (i) => (i.note = "private"),
    (i) => (i.date = "2000-01-01"),
    (i) => i.bodies.reverse(),
    (i) => i.aspects.pop(),
    (i) => (i.versions.content = "future"),
    (i) => (i.bodies[0].house = 0),
  ]) {
    const input = structuredClone(fixtures[0].facts);
    mutate(input);
    assert.equal((await call({ op: "natalInterpret", input })).ok, false);
  }
  for (const mutate of [
    (c) => (c.bodies[0].sign = 99),
    (c) => (c.bodies[0].longitude += 30),
    (c) => c.aspects.pop(),
    (c) => (c.interval[0] = "2001-01-01T00:00:00+00:00"),
  ]) {
    const chart = structuredClone(fixtures[0].chart);
    mutate(chart);
    assert.equal((await call({ op: "restoreNatal", chart })).ok, false);
  }
  const bad = structuredClone(semantics);
  delete bad.meanings["aspect.sun.moon.square"];
  assert.equal(
    (await call({ op: "natalInitialize", semantics: bad, rules })).ok,
    false,
  );
  assert.equal(
    (await call({ op: "natalInterpret", input: fixtures[0].facts })).ok,
    true,
    "failed installation keeps the prior valid pack",
  );
});
test("saved natal envelopes preserve legacy facts and expose unavailable versions without overwriting", () => {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
    f = fixtures[0];
  values.set(
    "pxoracle.astrology-chart.v1",
    JSON.stringify({
      schemaVersion: 1,
      value: { input: f.input, chart: f.chart },
    }),
  );
  const legacy = readNatal(storage);
  assert.equal(legacy.mode, "legacy");
  assert.deepEqual(legacy.chart, f.chart);
  const saved = {
    schemaVersion: 1,
    input: f.input,
    chart: f.chart,
    plan: f.plan,
    versions: f.plan.versions,
    place: null,
    savedAt: "2026-10-11T00:00:00Z",
  };
  saveNatal(storage, saved);
  assert.equal(readNatal(storage).mode, "current");
  for (const [country, atlasVersion] of [["JP", "geonames-world.2026-10-11"], ["KR", "geonames-us-kr.2026-10-11"]]) {
    const place = {source:"atlas",label:"Saved birthplace",cityId:"1835848",country,atlasVersion};
    saveNatal(storage, {...saved,place});
    assert.deepEqual(readNatal(storage).place,place);
    assert.deepEqual(readNatal(storage).chart,f.chart);
  }
  const future = structuredClone(saved);
  future.versions.content = "future";
  values.set(NATAL_KEY, JSON.stringify(future));
  assert.equal(readNatal(storage).mode, "unsupported");
  assert.deepEqual(readNatal(storage).chart, f.chart);
  assert.ok(values.has("pxoracle.astrology-chart.v1"));
  assert.equal(inputsMatch({ ...f.input, longitude: 0 }, f.chart), false);
  values.set(NATAL_KEY, "{broken");
  assert.throws(() => readNatal(storage));
  deleteNatal(storage);
  assert.equal(values.size, 0);
  values.set(
    "pxoracle.astrology.v1",
    JSON.stringify({ schemaVersion: 1, value: f.input }),
  );
  assert.equal(readNatal(storage).mode, "input-only");
});
test("clustered and wraparound display markers retain true angles with stable separation", () => {
  for (const angles of [
    [359, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 359],
    [0, 20, 40, 60, 80, 100, 120, 200, 280, 359],
  ]) {
    const bodies = angles.map((longitude, i) => ({ id: String(i), longitude })),
      layout = layoutMarkers(bodies, 26);
    assert.deepEqual(layout, layoutMarkers([...bodies].reverse(), 26));
    layout.forEach((b) =>
      assert.equal(b.longitude, bodies.find((x) => x.id === b.id).longitude),
    );
    const sorted = layout.map((b) => b.displayLongitude).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++)
      assert.ok(
        (sorted[(i + 1) % sorted.length] - sorted[i] + 360) % 360 >= 25.999,
      );
  }
});
