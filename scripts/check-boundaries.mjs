import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const rules = [
  [
    "packages/scenes/src",
    /engine-client|localStorage|crypto\.getRandomValues|WebAssembly/,
  ],
  [
    "packages/scene-runtime/src",
    /engine-client|localStorage|calculateNatal|pxoracle-tarot/,
  ],
  ["packages/contracts/src", /from ['"](?:three|zustand|react)|new Worker/],
  ["crates/pxoracle-tarot-reading/src", /pxoracle_tarot::|pxoracle-astrology|web_sys|js_sys|include_str!|std::fs|reqwest/],
  ["crates/pxoracle-natal-reading/src", /pxoracle_astrology::|pxoracle-tarot|pxoracle_ephemeris|web_sys|js_sys|include_str!|std::fs|reqwest/],
  ["crates/pxoracle-tarot", /pxoracle-astrology|web_sys|js_sys/],
  ["crates/pxoracle-astrology", /pxoracle-tarot|web_sys|js_sys/],
];
for (const [dir, forbidden] of rules)
  for (const file of files(dir)) {
    if (forbidden.test(readFileSync(file, "utf8")))
      throw new Error(`Forbidden dependency: ${file}`);
  }
console.log("Package/crate ownership boundaries verified");
