import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import reading from "../apps/web/src/features/tarot/reading.ts";
import persistence from "../apps/web/src/features/tarot/persistence.ts";
const { renderPhrase, validateReferences, readingInput } = reading;
const { parseSavedTarot, readSavedTarot, saveTarot, deleteTarot } = persistence;
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const base = "content/tarot/reading/",
  semantics = json(base + "semantics.2.json"),
  rules = json(base + "rules.2.json"),
  prose = json(base + "reading.en.1.1.json");
const fixtures = json("tests/fixtures/readings.json");
let mod;
async function call(payload) {
  if (!mod) {
    const { default: create } = await import(
      "../apps/web/public/engines/tarot/engine.mjs"
    );
    mod = await create({
      wasmBinary: readFileSync("apps/web/public/engines/tarot/engine.wasm"),
    });
  }
  const text = JSON.stringify(payload),
    ptr = mod._malloc(mod.lengthBytesUTF8(text) + 1);
  let out;
  try {
    mod.stringToUTF8(text, ptr, mod.lengthBytesUTF8(text) + 1);
    out = mod._px_process(ptr);
    return JSON.parse(mod.UTF8ToString(out));
  } finally {
    mod._free(ptr);
    if (out) mod._px_free(out);
  }
}
test("156 authored meanings, references, bounds and reproducible packs", () => {
  execFileSync("python3", ["scripts/build-reading-content.py", "--check"]);
  assert.equal(Object.keys(semantics.meanings).length, 156);
  assert.deepEqual(
    new Set(semantics.referenceIds),
    new Set(Object.keys(prose.strings)),
  );
  const actions = new Set(),
    questions = new Set();
  for (const [key, m] of Object.entries(semantics.meanings)) {
    assert.equal(Object.keys(m.topicRefs).length, 4);
    assert.equal(Object.keys(m.roleRefs).length, 9);
    for (const ref of [
      m.coreRef,
      m.resourceRef,
      m.difficultyRef,
      m.actionRef,
      m.questionRef,
      ...Object.values(m.topicRefs),
      ...Object.values(m.roleRefs),
    ])
      assert.ok(prose.strings[ref], `${key}: ${ref}`);
    actions.add(prose.strings[m.actionRef]);
    questions.add(prose.strings[m.questionRef]);
    assert.equal(m.lens === "direct", key.endsWith(".upright"));
  }
  assert.equal(actions.size, 156);
  assert.equal(questions.size, 156);
  const binary = readFileSync("apps/web/public/engines/tarot/engine.wasm");
  for (const text of Object.values(prose.strings)) {
    assert.ok(text.length < 1500);
    if (text.length > 50)
      assert.equal(binary.includes(Buffer.from(text)), false);
    assert.doesNotMatch(
      text,
      /TODO|lorem ipsum|your question means|you will certainly/i,
    );
  }
  for (const name of ["semantics.2", "rules.2", "reading.en.1.1"])
    assert.equal(
      readFileSync(base + name + ".json", "utf8"),
      readFileSync("apps/web/public/content/reading/" + name + ".json", "utf8"),
    );
});
test("native/WASM plans match frozen fixtures, all 12 perspectives and every orientation", async () => {
  assert.equal(
    (await call({ op: "readingInitialize", semantics, rules })).ok,
    true,
  );
  const inputs = fixtures.map((f) => f.input);
  for (const key of Object.keys(semantics.meanings)) {
    const orientation = key.endsWith(".upright") ? "upright" : "reversed",
      cardId = key.replace(/\.(upright|reversed)$/, ""),
      input = structuredClone(inputs[0]);
    const others = ["major.20", "major.21", "cups.14"].filter(
      (id) => id !== cardId,
    );
    input.cards.forEach((c, i) => {
      c.cardId = i === 0 ? cardId : others[i - 1];
      c.orientation = orientation;
    });
    inputs.push(input);
  }
  writeFileSync("/tmp/pxoracle-reading-parity.json", JSON.stringify(inputs));
  const native = JSON.parse(
    execFileSync(
      "cargo",
      [
        "run",
        "--quiet",
        "--locked",
        "-p",
        "pxoracle-tarot-reading",
        "--example",
        "evaluate",
        "--",
        base + "semantics.2.json",
        base + "rules.2.json",
        "/tmp/pxoracle-reading-parity.json",
      ],
      { encoding: "utf8" },
    ),
  );
  const schema = new Ajv({
    strict: false,
    formats: { uint: true, uint32: true },
  }).compile(json("packages/contracts/schemas/reading-plan.json"));
  for (let i = 0; i < inputs.length; i++) {
    const response = await call({ op: "readingInterpret", input: inputs[i] });
    assert.equal(response.ok, true);
    assert.deepEqual(response.result, native[i]);
    assert.ok(schema(response.result));
    validateReferences(response.result, prose);
    if (i < fixtures.length) assert.deepEqual(native[i], fixtures[i].plan);
  }
  assert.equal(
    new Set(
      native
        .slice(0, 12)
        .map((p) => p.overall.map((f) => renderPhrase(f, prose)).join(" ")),
    ).size,
    12,
  );
  for (const kind of ["repetition", "complement", "tension"])
    assert.ok(native.some((p) => p.relations[0]?.kind === kind));
  assert.ok(native.some((p) => p.fallback));
});
test("wire rejects hidden data, malformed positions, duplicate IDs and unsupported versions", async () => {
  await call({ op: "readingInitialize", semantics, rules });
  for (const mutate of [
    (i) => (i.note = "secret"),
    (i) => (i.deck = []),
    (i) => (i.cards[0].cardId = "unknown"),
    (i) => (i.cards[1].cardId = i.cards[0].cardId),
    (i) => i.cards.reverse(),
    (i) => i.cards.pop(),
    (i) => (i.versions.rules = "future"),
    (i) => (i.cards[0].orientation = "sideways"),
  ]) {
    const input = structuredClone(fixtures[0].input);
    mutate(input);
    assert.equal((await call({ op: "readingInterpret", input })).ok, false);
  }
  const validate = new Ajv({
    strict: false,
    formats: { uint: true, uint32: true },
  }).compile(json("packages/contracts/schemas/reading-input.json"));
  assert.ok(validate(fixtures[0].input));
  assert.equal(validate({ ...fixtures[0].input, note: "secret" }), false);
  assert.equal(validate({ ...fixtures[0].input, cards: [] }), false);
  assert.throws(() =>
    renderPhrase(
      { reference: "missing", arguments: [], cardIndices: [] },
      prose,
    ),
  );
});
test("versioned saves retain cards, require legacy perspective and never persist notes", () => {
  const draw = json("tests/fixtures/engines.json").session,
    values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  storage.setItem(
    "pxoracle.tarot.v1",
    JSON.stringify({ schemaVersion: 1, value: draw }),
  );
  const legacy = readSavedTarot(storage);
  assert.deepEqual(legacy.draw, draw);
  assert.equal(legacy.perspective, null);
  saveTarot(storage, draw, fixtures[0].input.context, semantics.versions);
  assert.deepEqual(readSavedTarot(storage).readingVersions, semantics.versions);
  const future = readSavedTarot(storage);
  future.readingVersions.content = "future.2";
  assert.equal(
    parseSavedTarot(JSON.stringify(future)).readingVersions.content,
    "future.2",
  );
  storage.setItem("pxoracle.tarot.v2", "{broken");
  assert.throws(() => readSavedTarot(storage));
  assert.throws(() =>
    parseSavedTarot(JSON.stringify({ ...future, note: "private" })),
  );
  deleteTarot(storage);
  assert.equal(readSavedTarot(storage), null);
  const selected = {
    ...draw,
    spread: 3,
    selections: fixtures[0].input.cards.map((c, i) => ({
      slot: i,
      card: { cardId: c.cardId, orientation: c.orientation },
      positionId: c.positionId,
      revealed: true,
    })),
  };
  assert.deepEqual(
    readingInput(selected, fixtures[0].input.context, semantics.versions),
    fixtures[0].input,
  );
  selected.selections[0].revealed = false;
  assert.throws(() =>
    readingInput(selected, fixtures[0].input.context, semantics.versions),
  );
});

test("all rule advice resolves by topic and intent; old release stays immutable", () => {
  for (const [file, digest] of Object.entries({
    "semantics.1.json": "0fd3eccd96f746b5baeca122a19d0c4ed2ef62c30dd096c7dec9f642e0ccd4e1",
    "rules.1.json": "fb6f82b5f1addd75e30fcdfe550e2a97e9af5d88bc844d49c8628120f5351101",
    "reading.en.1.json": "ea929ef93f75ec25f8e13576cac4b95f8c74c5a7d848169c6ad98df362f44c93",
  })) {
    for (const dir of [base, "apps/web/public/content/reading/"]) {
      assert.equal(createHash("sha256").update(readFileSync(dir + file)).digest("hex"), digest);
    }
  }
  const old = json(base + "reading.en.1.json");
  assert.equal(old.version, "reading.en.1");
  assert.equal(reading.currentVersions(json(base + "semantics.1.json").versions), false);
  for (const rule of rules.rules) {
    for (const topic of ["relationships", "work", "creativity", "growth"]) {
      for (const intent of ["present", "crossroads", "action"]) {
        for (const part of ["actionRefs", "questionRefs"]) {
          assert.ok(prose.strings[rule[part][topic][intent]], `${rule.id}/${topic}/${intent}/${part}`);
        }
      }
    }
  }
  const work = rules.rules.find(r => r.id === "tension.care-boundaries");
  const action = prose.strings[work.actionRefs.work.action];
  assert.match(action, /request help or propose a smaller contribution/);
  assert.doesNotMatch(action, /offer one specific form of support/);
  const hermit = semantics.meanings["major.09.reversed"];
  const difficulty = prose.strings[hermit.roleRefs.difficulty];
  assert.ok(difficulty.includes(prose.strings[hermit.difficultyRef]));
  assert.doesNotMatch(difficulty, /dependence on agreement/);
});

test("shared evidence framing does not hide a secondary connection", () => {
  const fixture = fixtures.find(f => f.plan.relations.length === 2);
  assert.ok(fixture);
  const view = reading.composeReading(fixture.plan, prose);
  assert.equal(view.relations[0].text, reading.MAIN_CONNECTION_TEXT);
  assert.equal(view.relations[1].text, view.relations[1].fullText);
  for (const name of view.relations[1].cardNames) assert.ok(view.relations[1].text.includes(name));
});

test("old interpretation versions require an explicit update without replacing the draw", () => {
  const oldVersions = json(base + "semantics.1.json").versions;
  const draw = json("tests/fixtures/engines.json").session;
  const raw = JSON.stringify({schemaVersion:2,draw,perspective:fixtures[0].input.context,readingVersions:oldVersions});
  const restored = parseSavedTarot(raw);
  assert.equal(reading.currentVersions(restored.readingVersions), false);
  assert.deepEqual(restored.draw, draw);
  assert.deepEqual(restored.readingVersions, oldVersions);
});
