// Streaming, independent parser/validator for one exported CSV (.csv.gz or .csv).
// Shares nothing with the writer except the column list and canonical enumeration definition.
import { createReadStream, createWriteStream, writeSync, openSync, closeSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createHash, hash } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import {
  COLUMNS, TEXT_COLUMNS, CsvParser, ROLES_BY_INTENT, EXPORT_SCHEMA, FULL_DECK, decodeCase, deckIds, loadPacks, reading,
} from "./common.mjs";

const LENSES = new Set(["direct", "inward", "blockage", "excess", "review", "restoration"]);
const FORMULA = new Set(["=", "+", "-", "@", "\t", "\r"]);
const COL = Object.fromEntries(COLUMNS.map((c, i) => [c, i]));

export async function validateFile(job) {
  const { path, topic, intent, deckSize = FULL_DECK, start = 0, end = null, cases = null, sampleSet = [], hashOut = null, gz = path.endsWith(".gz") } = job;
  const P = loadPacks();
  const ids = deckIds(deckSize);
  const sample = new Set(sampleSet);
  const expectedRows = cases ? cases.length : end - start;
  const roles = ROLES_BY_INTENT[intent];
  const ruleKind = new Map(P.rules.rules.map((r) => [r.id, r.kind]));
  const errors = [];
  let errorCount = 0;
  const fail = (row, msg) => { errorCount++; if (errors.length < 20) errors.push(`row ${row}: ${msg}`); };
  const res = {
    path, topic, intent, rows: 0, firstCase: null, lastCase: null, expectedRows,
    gzBytes: 0, gzSha256: null, rawBytes: 0, rawSha256: null,
    rules: {}, fallbackRows: 0, formulaLeading: {}, distinct: {}, samples: {},
  };
  const distinct = Object.fromEntries(TEXT_COLUMNS.map((c) => [c, new Set()]));
  const hashFd = hashOut ? openSync(hashOut, "w") : null;
  let hashBuf = Buffer.allocUnsafe(56 * 4096), hashN = 0;
  let headerSeen = false, rowNo = 0;
  const verCols = [["engine_version", P.versions.engine], ["semantics_version", P.versions.semantics], ["rules_version", P.versions.rules], ["content_version", P.versions.content], ["export_schema_version", EXPORT_SCHEMA]];

  const onRecord = (f) => {
    if (!headerSeen) {
      headerSeen = true;
      if (f.length !== COLUMNS.length || f.some((v, i) => v !== COLUMNS[i])) fail(0, "header mismatch");
      return;
    }
    rowNo++;
    if (f.length !== COLUMNS.length) return fail(rowNo, `expected ${COLUMNS.length} fields got ${f.length}`);
    const idText = f[0];
    const expected = cases ? cases[rowNo - 1] : start + rowNo - 1;
    if (idText !== String(expected)) { fail(rowNo, `case_id ${idText} expected ${expected}`); return; }
    if (res.firstCase === null) res.firstCase = expected;
    res.lastCase = expected;
    if (f[COL.topic] !== topic || f[COL.intent] !== intent) fail(rowNo, "context mismatch");
    let cards;
    try { cards = decodeCase(expected, deckSize); } catch (e) { fail(rowNo, String(e.message)); return; }
    const seen = new Set();
    for (let i = 0; i < 3; i++) {
      const id = ids[cards[i][0]], k = 3 + i * 3;
      seen.add(f[k]);
      if (f[k] !== id) fail(rowNo, `card_${i + 1}_id ${f[k]} expected ${id}`);
      if (f[k + 1] !== P.prose.strings[`name.${id}`]) fail(rowNo, `card_${i + 1}_name`);
      if (f[k + 2] !== (cards[i][1] ? "reversed" : "upright")) fail(rowNo, `card_${i + 1}_orientation`);
      const r = 12 + i * 3;
      if (f[r] !== roles[i]) fail(rowNo, `position_${i + 1}_role ${f[r]}`);
      if (f[r + 1] !== reading.ROLE_LABELS[roles[i]]) fail(rowNo, `position_${i + 1}_role_label`);
      if (!LENSES.has(f[r + 2]) || (f[r + 2] === "direct") !== !cards[i][1]) fail(rowNo, `position_${i + 1}_lens ${f[r + 2]}`);
    }
    if (seen.size !== 3) fail(rowNo, "duplicate cards");
    for (const c of TEXT_COLUMNS) {
      const v = f[COL[c]];
      if (!v) fail(rowNo, `blank ${c}`);
      else if (v.includes("{") || v.includes("}") || v.includes("[object Object]")) fail(rowNo, `placeholder in ${c}`);
    }
    for (const [c, want] of verCols) if (f[COL[c]] !== want) fail(rowNo, `${c} ${f[COL[c]]}`);
    // relation consistency
    const ruleIds = f[COL.relation_rule_ids] ? f[COL.relation_rule_ids].split("|") : [];
    const evidence = f[COL.relation_evidence] ? f[COL.relation_evidence].split("|") : [];
    if (f[COL.fallback] === "true") {
      res.fallbackRows++;
      if (ruleIds.length || evidence.length || f[COL.relation_text] !== reading.FALLBACK_RELATION_TEXT) fail(rowNo, "fallback row has relations");
    } else if (f[COL.fallback] === "false") {
      if (!ruleIds.length || ruleIds.length > 2 || ruleIds.length !== evidence.length) fail(rowNo, "relation count");
      ruleIds.forEach((id, i) => {
        const kind = ruleKind.get(id);
        if (!kind) return fail(rowNo, `unknown rule ${id}`);
        const m = /^(\w+):([123](?:\+[123]){1,2})$/.exec(evidence[i] ?? "");
        if (!m || m[1] !== kind) fail(rowNo, `evidence ${evidence[i]} for ${id}`);
        const e = (res.rules[id] ??= { any: 0, primary: 0 });
        e.any++;
        if (i === 0) e.primary++;
      });
    } else fail(rowNo, "fallback value");
    for (let i = 0; i < f.length; i++) {
      const v = f[i];
      if (v && FORMULA.has(v[0])) res.formulaLeading[COLUMNS[i]] = (res.formulaLeading[COLUMNS[i]] ?? 0) + 1;
    }
    if (hashFd !== null && hashN === 4096) { writeSync(hashFd, hashBuf, 0, hashN * 56); hashN = 0; }
    TEXT_COLUMNS.forEach((c, s) => {
      const h = hash("sha1", f[COL[c]], "buffer");
      if (hashFd !== null) h.copy(hashBuf, hashN * 56 + s * 8, 0, 8);
      distinct[c].add(h.readUIntBE(0, 6) * 32 + (h[6] & 31));
    });
    if (hashFd !== null) hashN++;
    if (sample.has(expected)) res.samples[expected] = f;
  };
  const parser = new CsvParser(onRecord);
  const raw = createHash("sha256"), packed = createHash("sha256");
  const dec = new StringDecoder("utf8");
  const source = createReadStream(path);
  source.on("data", (b) => { packed.update(b); res.gzBytes += b.length; });
  let body = source;
  if (gz) body = source.pipe(createGunzip());
  // gunzip failures (truncation, bad CRC) surface as stream errors
  const finished = new Promise((resolve, reject) => { source.on("error", reject); body.on("error", reject); });
  const consume = (async () => {
    for await (const b of body) {
      raw.update(b); res.rawBytes += b.length;
      const text = dec.write(b);
      if (text.includes("�")) fail(rowNo, "invalid UTF-8 / replacement character");
      parser.push(text);
    }
    const tail = dec.end(); if (tail) parser.push(tail);
    parser.end();
  })();
  try { await Promise.race([consume, finished]); await consume; }
  catch (e) { fail(rowNo, `stream: ${e.message}`); }
  if (hashFd !== null) { writeSync(hashFd, hashBuf, 0, hashN * 56); closeSync(hashFd); }
  res.rows = rowNo;
  if (!gz) res.gzBytes = res.rawBytes;
  if (rowNo !== expectedRows) fail(rowNo, `row count ${rowNo} expected ${expectedRows}`);
  res.gzSha256 = packed.digest("hex"); res.rawSha256 = raw.digest("hex");
  for (const c of TEXT_COLUMNS) res.distinct[c] = distinct[c].size;
  res.errorCount = errorCount; res.errors = errors;
  return res;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  validateFile(JSON.parse(process.argv[2])).then(
    (r) => process.stdout.write(JSON.stringify(r)),
    (e) => { process.stderr.write(String(e?.stack || e)); process.exit(1); },
  );
}
