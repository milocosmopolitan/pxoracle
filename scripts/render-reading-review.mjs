import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import reading from "../apps/web/src/features/tarot/reading.ts";
const pack = JSON.parse(
    readFileSync("content/tarot/reading/reading.en.1.json"),
  ),
  fixtures = JSON.parse(readFileSync("tests/fixtures/readings.json"));
const text = (p) => reading.renderPhrase(p, pack);
let md =
  "# Rendered reading examples\n\nSynthetic card fixtures evaluated by the native Rust interpreter, identical to the checked WASM plans. These are complete user-visible compositions, not user notes. Agent editorial review is recorded separately; human approval is not claimed.\n";
for (const f of fixtures) {
  const p = f.plan;
  md += `\n## ${f.label}\n\n${p.cards.map((c) => `${pack.strings["name." + c.cardId]} (${c.orientation})`).join(" → ")}\n\n${p.overall.map(text).join(" ")}\n\n**Connections:** ${p.relations.map((r) => `${r.ruleId} [${r.cardIndices.map((i) => i + 1)}]: ${text(r.phrase)}`).join(" ") || "No strong relationship. Position-flow fallback."}\n\n**One action:** ${text(p.action)}\n\n**Reflection:** ${text(p.question)}\n`;
  for (const d of p.positions)
    md += `\n### ${d.index + 1}. ${d.role}\n\n${d.phrases.map(text).join(" ")}\n`;
}
mkdirSync("docs/validation/reading", { recursive: true });
writeFileSync("docs/validation/reading/examples.md", md);
const paths = [
  "apps/web/public/engines/tarot/engine.wasm",
  "apps/web/public/engines/tarot/engine.mjs",
  "apps/web/public/engines/tarot/worker.mjs",
  ...["semantics.1", "rules.1", "reading.en.1"].map(
    (n) => `apps/web/public/content/reading/${n}.json`,
  ),
];
writeFileSync(
  "docs/validation/reading/sizes.json",
  JSON.stringify(
    paths.map((path) => {
      const bytes = readFileSync(path);
      return { path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
    }),
    null,
    2,
  ) + "\n",
);
