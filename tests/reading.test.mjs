import test from "node:test";
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
  semantics = json(base + "semantics.1.json"),
  rules = json(base + "rules.1.json"),
  prose = json(base + "reading.en.1.json");
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
  for (const name of ["semantics.1", "rules.1", "reading.en.1"])
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
        base + "semantics.1.json",
        base + "rules.1.json",
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
