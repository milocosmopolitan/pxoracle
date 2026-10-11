import { readFileSync, writeFileSync } from "node:fs";
const family = process.argv[2] ?? "reading";
const roots = ["input", "plan", "semantics", "rules"].map((x) =>
  JSON.parse(readFileSync(`packages/contracts/schemas/${family}-${x}.json`)),
);
const definitions = Object.assign({}, ...roots.map((s) => s.$defs));
function type(s) {
  if (Array.isArray(s.type)) return s.type.map(t => type({ ...s, type: t })).join(" | ");
  if (s.$ref) return s.$ref.split("/").at(-1);
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((x) => JSON.stringify(x)).join(" | ");
  if (s.anyOf || s.oneOf) return (s.anyOf || s.oneOf).map(type).join(" | ");
  if (s.type === "array") return `Array<${type(s.items)}>`;
  if (s.type === "object") {
    if (!s.properties)
      return `Record<string, ${s.additionalProperties && typeof s.additionalProperties === "object" ? type(s.additionalProperties) : "unknown"}>`;
    return `{ ${Object.entries(s.properties)
      .map(
        ([k, v]) =>
          `${JSON.stringify(k)}${s.required?.includes(k) ? "" : "?"}: ${type(v)}`,
      )
      .join("; ")} }`;
  }
  return (
    {
      integer: "number",
      number: "number",
      string: "string",
      boolean: "boolean",
      null: "null",
    }[s.type] ?? "unknown"
  );
}
for (const s of roots) definitions[s.title] = s;
const out =
  "// Generated from Rust schemars DTOs. Run scripts/generate-schemas.sh.\n" +
  Object.entries(definitions)
    .sort()
    .map(([n, s]) => `export type ${n} = ${type(s)};`)
    .join("\n") +
  "\n";
writeFileSync(`packages/contracts/src/${family}.ts`, out);
