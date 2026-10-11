import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync("scripts/worker.mjs", "utf8").replace(
  /let initialized;[\s\S]*?function dispatch/,
  "async function engine() { return mock; }\nfunction dispatch",
);
const fixture = JSON.parse(readFileSync("tests/fixtures/readings.json"))[0];
function harness() {
  let text = "",
    result = "",
    fail = false;
  const commands = [],
    fetches = [],
    responses = [];
  const mock = {
    lengthBytesUTF8: (s) => s.length,
    _malloc: () => 1,
    stringToUTF8: (s) => {
      text = s;
    },
    _px_process: () => {
      const p = JSON.parse(text);
      commands.push(p);
      result = JSON.stringify({
        ok: true,
        result:
          p.op === "readingInitialize" ? { initialized: true } : fixture.plan,
      });
      return 2;
    },
    UTF8ToString: () => result,
    _free() {},
    _px_free() {},
  };
  const self = { postMessage: (r) => responses.push(r) };
  const context = vm.createContext({
    mock,
    self,
    fetch: async (url) => {
      fetches.push(url);
      if (fail) return { ok: false };
      return {
        ok: true,
        text: async () => readFileSync(`apps/web/public${url}`, "utf8"),
      };
    },
  });
  vm.runInContext(source, context);
  return {
    commands,
    fetches,
    responses,
    fail: (v) => {
      fail = v;
    },
    send: (id, input = fixture.input) =>
      self.onmessage({
        data: { version: 1, id, payload: { op: "readingInterpret", input } },
      }),
  };
}
test("concurrent interpretations install each semantic/rule pack once per worker and never prose", async () => {
  const h = harness();
  await Promise.all([h.send(1), h.send(2)]);
  await h.send(3);
  assert.equal(h.fetches.length, 2);
  assert.equal(
    h.commands.filter((p) => p.op === "readingInitialize").length,
    1,
  );
  assert.equal(h.commands.filter((p) => p.op === "readingInterpret").length, 3);
  assert.ok(h.fetches.every((p) => !p.includes("reading.en")));
  assert.deepEqual(h.responses.map((r) => r.id).sort(), [1, 2, 3]);
  const fresh = harness();
  await fresh.send(4);
  assert.equal(fresh.fetches.length, 2);
});
test("failed pack installation retries the same public input and unsupported versions never fetch", async () => {
  const h = harness();
  h.fail(true);
  await h.send(1);
  assert.equal(h.responses[0].error.code, "READING_PACK_FAILED");
  assert.equal(h.commands.length, 0);
  h.fail(false);
  await h.send(2);
  assert.equal(h.responses[1].ok, true);
  assert.deepEqual(h.commands.at(-1).input, fixture.input);
  const before = h.fetches.length;
  await h.send(3, {
    ...fixture.input,
    versions: { ...fixture.input.versions, content: "future" },
  });
  assert.equal(h.responses[2].error.code, "READING_VERSION");
  assert.equal(h.fetches.length, before);
});
