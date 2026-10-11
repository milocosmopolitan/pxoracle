import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("CloudFront rewrites only directory documents and preserves assets/RSC data", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL("../infra/cloudfront-function.js", import.meta.url), "utf8"), context);
  for (const [input, expected] of Object.entries({
    "/": "/index.html", "/tarot": "/tarot/index.html", "/tarot/": "/tarot/index.html",
    "/astrology/": "/astrology/index.html", "/tarot/index.txt": "/tarot/index.txt",
    "/engines/tarot/engine.wasm": "/engines/tarot/engine.wasm",
    "/engines/tarot/worker.mjs": "/engines/tarot/worker.mjs",
    "/missing.js": "/missing.js", "/404.html": "/404.html",
  })) {
    const request = { uri: input, querystring: { _rsc: { value: "fixture" } } };
    assert.equal(context.handler({ request }).uri, expected);
    assert.equal(request.querystring._rsc.value, "fixture");
  }
});
