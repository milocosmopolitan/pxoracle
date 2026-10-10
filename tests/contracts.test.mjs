import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const json = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url)));
test("manifest has exact standard deck and every runtime asset exists", () => {
  const manifest = json("assets/manifests/art.json");
  const ids = [
    ...Array.from(
      { length: 22 },
      (_, n) => `major.${String(n).padStart(2, "0")}`,
    ),
    ...["wands", "cups", "swords", "pentacles"].flatMap((s) =>
      Array.from(
        { length: 14 },
        (_, n) => `${s}.${String(n + 1).padStart(2, "0")}`,
      ),
    ),
  ];
  assert.deepEqual(Object.keys(manifest.cards).sort(), ids.sort());
  for (const asset of Object.values(manifest.assets)) {
    assert.equal(
      readFileSync(new URL("../apps/web/public" + asset.url, import.meta.url))
        .length,
      asset.bytes,
    );
  }
});
test("SSG outputs include direct routes, no application server", () => {
  for (const route of ["", "tarot/", "astrology/"]) {
    const html = readFileSync(
      new URL("../apps/web/out/" + route + "index.html", import.meta.url),
      "utf8",
    );
    assert.match(html, /<h1/);
    assert.doesNotMatch(html, /storybook-static/);
  }
});
