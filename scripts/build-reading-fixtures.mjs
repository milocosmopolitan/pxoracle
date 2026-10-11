import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const semantics = JSON.parse(
  readFileSync("content/tarot/reading/semantics.2.json"),
);
const positions = ["situation", "examination", "next_action"];
const input = (
  ids,
  topic = "relationships",
  intent = "present",
  reversed = false,
) => ({
  versions: semantics.versions,
  context: { topic, intent },
  cards: ids.map((cardId, i) => ({
    cardId,
    orientation: reversed ? "reversed" : "upright",
    positionId: positions[i],
  })),
});
const fixtures = [];
for (const topic of ["relationships", "work", "creativity", "growth"])
  for (const intent of ["present", "crossroads", "action"])
    fixtures.push({
      label: `${topic}-${intent}`,
      input: input(["major.00", "major.04", "major.14"], topic, intent),
    });
fixtures.push({
  label: "all-reversed",
  input: input(
    ["major.09", "swords.09", "pentacles.05"],
    "growth",
    "action",
    true,
  ),
});
fixtures.push({
  label: "repetition",
  input: input(["major.00", "major.01", "major.06"]),
});
fixtures.push({
  label: "complement",
  input: input(["major.00", "major.01", "major.07"]),
});
fixtures.push({
  label: "fallback",
  input: input(["major.00", "major.01", "cups.01"]),
});
fixtures.push({
  label: "court-and-minor",
  input: input(["wands.14", "cups.12", "pentacles.11"], "work", "crossroads"),
});
const mixed = input(
  ["major.16", "swords.04", "cups.06"],
  "creativity",
  "action",
);
mixed.cards[1].orientation = "reversed";
fixtures.push({ label: "mixed-orientations", input: mixed });
writeFileSync(
  "/tmp/pxoracle-reading-inputs.json",
  JSON.stringify(fixtures.map((f) => f.input)),
);
const plans = JSON.parse(
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
      "content/tarot/reading/semantics.2.json",
      "content/tarot/reading/rules.2.json",
      "/tmp/pxoracle-reading-inputs.json",
    ],
    { encoding: "utf8" },
  ),
);
writeFileSync(
  "tests/fixtures/readings.json",
  JSON.stringify(
    fixtures.map((f, i) => ({ ...f, plan: plans[i] })),
    null,
    2,
  ) + "\n",
);
console.log(
  plans
    .map(
      (p, i) =>
        `${fixtures[i].label}: ${p.relations.map((r) => r.ruleId).join(",") || "fallback"}`,
    )
    .join("\n"),
);
