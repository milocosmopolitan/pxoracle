// Full validation: independent per-file parsing, cross-context comparison, production parity, and reports.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync, rmSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXTS, TEXT_COLUMNS, FULL_DECK, ROOT, caseCount, encodeCase, loadPacks, rowFromPlan, deckIds } from "./common.mjs";
import { renderCases } from "./review.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const runValidator = (job) => new Promise((resolve, reject) => {
  const c = spawn(process.execPath, ["--import", "tsx", join(HERE, "validate-worker.mjs"), JSON.stringify(job)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = "";
  c.stdout.setEncoding("utf8"); c.stderr.setEncoding("utf8");
  c.stdout.on("data", (b) => (out += b)); c.stderr.on("data", (b) => (err += b));
  c.on("close", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`validator ${job.path}: ${err}`))));
});
async function pool(items, n, fn) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); } }));
  return results;
}
/** Deterministic sample: edges, chunk boundaries and an LCG spread. Includes production fixture cases. */
export function sampleCases({ start, end, deckSize, chunkSize, count = 2000 }) {
  const set = new Set();
  const inRange = (v) => v >= start && v < end && set.add(v);
  for (let i = 0; i < 64; i++) { inRange(start + i); inRange(end - 1 - i); }
  for (let b = Math.ceil(start / chunkSize) * chunkSize; b < end; b += chunkSize) { inRange(b - 1); inRange(b); }
  let x = 0x9e3779b1;
  for (let i = 0; i < count && end > start; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; inRange(start + (x % (end - start))); }
  return [...set].sort((a, b) => a - b);
}
function fixtureCases(packs, deckSize) {
  const fx = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/readings.json"), "utf8"));
  const ids = deckIds(deckSize);
  const out = [];
  for (const f of fx) {
    const idx = f.input.cards.map((c) => [ids.indexOf(c.cardId), c.orientation === "reversed"]);
    if (idx.some(([i]) => i < 0)) continue;
    out.push({ label: f.label, caseId: encodeCase(idx, deckSize), context: `${f.input.context.topic}-${f.input.context.intent}`, plan: f.plan });
  }
  return out;
}
function compareSections(dir, names, rows) {
  const BLOCK = 8192, R = 56, n = names.length;
  const fds = names.map((c) => openSync(join(dir, `.sections-${c}.bin`), "r"));
  const bufs = names.map(() => Buffer.alloc(BLOCK * R));
  const hist = TEXT_COLUMNS.map(() => new Array(n + 1).fill(0));
  const pair = TEXT_COLUMNS.map(() => Array.from({ length: n }, () => new Array(n).fill(0)));
  const lo = new Uint32Array(n), hi = new Uint32Array(n);
  for (let done = 0; done < rows; done += BLOCK) {
    const m = Math.min(BLOCK, rows - done);
    fds.forEach((fd, k) => { let got = 0; while (got < m * R) { const r = readSync(fd, bufs[k], got, m * R - got, done * R + got); if (!r) throw new Error("EXPORT_SECTIONS short read"); got += r; } });
    for (let r = 0; r < m; r++) for (let s = 0; s < TEXT_COLUMNS.length; s++) {
      for (let k = 0; k < n; k++) { const o = r * R + s * 8; lo[k] = bufs[k].readUInt32LE(o); hi[k] = bufs[k].readUInt32LE(o + 4); }
      let distinct = 0;
      for (let i = 0; i < n; i++) {
        let seen = false;
        for (let j = 0; j < i; j++) if (lo[i] === lo[j] && hi[i] === hi[j]) { seen = true; pair[s][j][i]++; }
        if (!seen) distinct++;
      }
      hist[s][distinct]++;
    }
  }
  fds.forEach(closeSync);
  return Object.fromEntries(TEXT_COLUMNS.map((c, s) => [c, { distinctPerCaseHistogram: Object.fromEntries(hist[s].map((v, d) => [d, v]).filter(([d, v]) => d > 0 && v > 0)), identicalPairs: Object.fromEntries(names.flatMap((a, i) => names.slice(i + 1).map((b, jj) => [`${a} = ${b}`, pair[s][i][i + 1 + jj]]))) }]));
}
/**
 * files: {ctx: {path, ...}} fully-qualified; expectation: {start,end,deckSize,chunkSize}
 */
export async function verifyExport({ dir, files, start, end, deckSize, chunkSize, jobs, expectedFiles = null, log = console.error }) {
  const packs = loadPacks();
  const rows = end - start;
  const samples = sampleCases({ start, end, deckSize, chunkSize });
  const fixtures = fixtureCases(packs, deckSize).filter((f) => f.caseId >= start && f.caseId < end);
  const sampleSet = [...new Set([...samples, ...fixtures.map((f) => f.caseId)])].sort((a, b) => a - b);
  const problems = [];
  const results = await pool(CONTEXTS, jobs, async (c) => {
    log(`validating ${c.name}`);
    return runValidator({ path: files[c.name], topic: c.topic, intent: c.intent, deckSize, start, end, sampleSet, hashOut: join(dir, `.sections-${c.name}.bin`) });
  });
  results.forEach((r, k) => {
    const c = CONTEXTS[k];
    if (r.errorCount) problems.push(`${c.name}: ${r.errorCount} row errors, e.g. ${r.errors.slice(0, 3).join("; ")}`);
    if (r.rows !== rows) problems.push(`${c.name}: rows ${r.rows} != ${rows}`);
    if (r.firstCase !== start || r.lastCase !== end - 1) problems.push(`${c.name}: case range ${r.firstCase}..${r.lastCase}`);
    const ex = expectedFiles?.[c.name];
    if (ex) {
      if (ex.sha256 !== r.gzSha256) problems.push(`${c.name}: checksum mismatch (manifest ${ex.sha256}, file ${r.gzSha256})`);
      if (ex.bytes !== r.gzBytes) problems.push(`${c.name}: byte size mismatch`);
      if (ex.rows !== r.rows) problems.push(`${c.name}: row count mismatch vs recorded`);
      if (ex.rawSha256 && ex.rawSha256 !== r.rawSha256) problems.push(`${c.name}: raw checksum mismatch`);
    }
  });
  // cross-context: identical case coverage and relation outcome (relations are context independent)
  const sig = (r) => JSON.stringify([r.rows, r.firstCase, r.lastCase, r.rules, r.fallbackRows]);
  results.forEach((r, k) => { if (sig(r) !== sig(results[0])) problems.push(`${CONTEXTS[k].name}: case set / relation frequencies differ from ${CONTEXTS[0].name}`); });
  let sections = null;
  if (!problems.length) sections = compareSections(dir, CONTEXTS.map((c) => c.name), rows);
  for (const c of CONTEXTS) rmSync(join(dir, `.sections-${c.name}.bin`), { force: true });
  // production parity: re-render sampled cases through a fresh runner and compare to the parsed CSV rows
  const parity = { sampled: sampleSet.length, mismatches: 0, fixtureCases: fixtures.length, fixtureMismatches: 0 };
  if (!problems.length) {
    const tmp = join(dir, ".parity"); mkdirSync(tmp, { recursive: true });
    const fresh = await renderCases({ cases: sampleSet, packs, deckSize, outDir: tmp });
    CONTEXTS.forEach((c, k) => sampleSet.forEach((id, i) => {
      const got = results[k].samples[id];
      if (!got || JSON.stringify(got) !== JSON.stringify(fresh[k][i])) { parity.mismatches++; if (parity.mismatches < 5) problems.push(`parity: ${c.name} case ${id}`); }
    }));
    for (const f of fixtures) {
      const k = CONTEXTS.findIndex((c) => c.name === f.context);
      if (JSON.stringify(results[k].samples[f.caseId]) !== JSON.stringify(rowFromPlan(f.caseId, f.plan, packs.prose))) { parity.fixtureMismatches++; problems.push(`fixture parity: ${f.label}`); }
    }
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: problems.length === 0, problems, rows, perContext: results.map((r) => ({ context: `${r.topic}-${r.intent}`, rows: r.rows, gzBytes: r.gzBytes, gzSha256: r.gzSha256, rawBytes: r.rawBytes, rawSha256: r.rawSha256, distinct: r.distinct, formulaLeading: r.formulaLeading })), rules: results[0].rules, fallbackRows: results[0].fallbackRows, sections, parity, sampleSize: sampleSet.length };
}
/** Validates review CSVs (explicit case list) and returns problems. */
export async function verifyReview({ files, cases, deckSize, jobs }) {
  const results = await pool(CONTEXTS, jobs, (c) => runValidator({ path: files[c.name], topic: c.topic, intent: c.intent, deckSize, cases }));
  const problems = [];
  results.forEach((r, k) => { if (r.errorCount) problems.push(`review ${CONTEXTS[k].name}: ${r.errors.slice(0, 3).join("; ")}`); });
  return { ok: !problems.length, problems, rows: cases.length, rules: results[0].rules, fallbackRows: results[0].fallbackRows, formulaLeading: results.map((r) => r.formulaLeading) };
}
