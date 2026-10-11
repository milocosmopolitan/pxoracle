import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
const source = readFileSync("scripts/worker.mjs", "utf8").replace(
  /let initialized;[\s\S]*?function dispatch/,
  "async function engine() { return mock; }\nfunction dispatch",
);
const fixture = JSON.parse(readFileSync("tests/fixtures/natal.json"))[0];
function harness() {
  let text = "",
    result = "",
    fail = false,
    corrupt = false;
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
          p.op === "natalInitialize" ? { initialized: true } : fixture.plan,
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
    crypto: webcrypto,
    TextDecoder,
    Uint8Array,
    fetch: async (url) => {
      fetches.push(url);
      if (fail) return { ok: false };
      return {
        ok: true,
        text: async () => readFileSync(`apps/web/public${url}`, "utf8"),
        headers: { get: () => null },
        arrayBuffer: async () => {
          const bytes = readFileSync(`apps/web/public${url}`);
          if (corrupt) bytes[0] ^= 1;
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      };
    },
  });
  vm.runInContext(source, context);
  return {
    corrupt: (v) => {
      corrupt = v;
    },
    commands,
    fetches,
    responses,
    fail: (v) => {
      fail = v;
    },
    send: (id, input = fixture.facts) =>
      self.onmessage({
        data: { version: 1, id, payload: { op: "natalInterpret", input } },
      }),
  };
}
test("concurrent interpretations install each semantic/rule pack once per worker and never prose", async () => {
  const h = harness();
  await Promise.all([h.send(1), h.send(2)]);
  await h.send(3);
  assert.equal(h.fetches.length, 3);
  assert.equal(h.commands.filter((p) => p.op === "natalInitialize").length, 1);
  assert.equal(h.commands.filter((p) => p.op === "natalInterpret").length, 3);
  assert.ok(h.fetches.every((p) => !p.includes("en.1")));
  assert.deepEqual(h.responses.map((r) => r.id).sort(), [1, 2, 3]);
  const fresh = harness();
  await fresh.send(4);
  assert.equal(fresh.fetches.length, 3);
});
test("failed pack installation retries the same public input and unsupported versions never fetch", async () => {
  const h = harness();
  h.fail(true);
  await h.send(1);
  assert.equal(h.responses[0].error.code, "NATAL_PACK_FAILED");
  assert.equal(h.commands.length, 0);
  h.fail(false);
  await h.send(2);
  assert.equal(h.responses[1].ok, true);
  assert.deepEqual(h.commands.at(-1).input, fixture.facts);
  const before = h.fetches.length;
  await h.send(3, {
    ...fixture.facts,
    versions: { ...fixture.facts.versions, content: "future" },
  });
  assert.equal(h.responses[2].error.code, "NATAL_VERSION");
  assert.equal(h.fetches.length, before);
});

test("natal integrity failure never installs data and a clean retry preserves the input", async () => {
  const h = harness();
  h.corrupt(true);
  await h.send(1);
  assert.equal(h.responses[0].error.code, "NATAL_PACK_FAILED");
  assert.equal(h.commands.length, 0);
  h.corrupt(false);
  await h.send(2);
  assert.equal(h.responses[1].ok, true);
  assert.deepEqual(h.commands.at(-1).input, fixture.facts);
  assert.equal(h.commands.filter((p) => p.op === "natalInitialize").length, 1);
});
