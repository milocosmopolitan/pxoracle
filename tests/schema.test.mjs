import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
const json = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url)));
const fixtures = json("tests/fixtures/engines.json");
test("Rust-generated schemas validate wire fixtures and reject malformed fields", () => {
  const ajv = new Ajv2020({ strict: false });
  ajv.addFormat("double", {type:"number",validate:Number.isFinite});
  ajv.addFormat("uint", {type:"number",validate:n=>Number.isSafeInteger(n)&&n>=0});
  ajv.addFormat("uint32", {type:"number",validate:n=>Number.isInteger(n)&&n>=0&&n<=4294967295});
  for (const [schema, key, data] of [
    ["astrology", "input", fixtures.birth],
    ["astrology", "astrology", fixtures.chart],
    ["tarot", "tarot", fixtures.session],
  ]) {
    const validate = ajv.compile(
      json(`packages/contracts/schemas/${schema}.json`)[key],
    );
    assert.ok(validate(data), JSON.stringify(validate.errors));
    assert.equal(validate({}), false);
  }
  const session = ajv.compile(
    json("packages/contracts/schemas/tarot.json").tarot,
  );
  assert.equal(session({ ...fixtures.session, spread: "3" }), false);
});

test('generated persistence validators accept actual results and reject malformed saves',async()=>{
 const {validateBirth,validateChart}=await import('../apps/web/src/features/persistence-validators.ts');
 assert.equal(validateBirth(fixtures.birth),true);
 assert.equal(validateChart(fixtures.chart),true);
 assert.equal(validateChart({...fixtures.chart,bodies:[{id:'sun'}]}),false);
 assert.equal(validateBirth({...fixtures.birth,latitude:'unknown'}),false);
});
