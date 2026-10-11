import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  COLUMNS, CsvParser, CONTEXTS, csvLine, caseCount, decodeCase, encodeCase, deckIds, loadPacks, rowFromPlan, sha256,
} from "../scripts/reading-export/common.mjs";

const BIN = "target/export/examples/reading-export";
const run = (args, opts = {}) =>
  spawnSync("node", ["--import", "tsx", "scripts/reading-export/cli.mjs", ...args, "--allow-dirty"], { encoding: "utf8", ...opts });
const tmp = () => mkdtempSync(join(tmpdir(), "pxexport-"));
test.before(() => {
  execFileSync("cargo", ["build", "--locked", "--profile", "export", "-p", "pxoracle-tarot-reading", "--example", "reading-export"], { stdio: "ignore" });
});
const packs = loadPacks();
const batch = (args) =>
  execFileSync(BIN, ["batch", "--semantics", packs.paths.semantics, "--rules", packs.paths.rules, ...args], { encoding: "utf8", maxBuffer: 1 << 28 })
    .trim().split("\n").map((l) => JSON.parse(l));

test("exact scope and canonical case ids with reference vectors", () => {
  assert.equal(caseCount(), 78 * 77 * 76 * 8);
  assert.equal(caseCount() * 12, 43_819_776);
  const ids = deckIds();
  const show = (id) => decodeCase(id).map(([c, r]) => ids[c] + (r ? ":R" : ":U"));
  assert.deepEqual(show(0), ["major.00:U", "major.01:U", "major.02:U"]);
  assert.deepEqual(show(1), ["major.00:R", "major.01:U", "major.02:U"]); // bit 0 = position 1
  assert.deepEqual(show(4), ["major.00:U", "major.01:U", "major.02:R"]); // bit 2 = position 3
  assert.deepEqual(show(7), ["major.00:R", "major.01:R", "major.02:R"]);
  assert.deepEqual(show(8), ["major.00:U", "major.01:U", "major.03:U"]); // third card varies fastest
  assert.deepEqual(show(caseCount() - 1), ["pentacles.14:R", "pentacles.13:R", "pentacles.12:R"]);
  // Rust runner agrees with the independent decoder on the same vectors
  const info = JSON.parse(execFileSync(BIN, ["info"], { encoding: "utf8" }));
  assert.equal(info.cases, caseCount());
  assert.equal(sha256(info.deck.join("\n") + "\n"), sha256(ids.join("\n") + "\n"));
  for (const v of info.vectors) assert.deepEqual(v.cards.map(([c, r]) => c + (r ? ":R" : ":U")), show(v.caseId));
});
test("toy deck enumeration is an exact bijection onto ordered distinct triples x 8 masks", () => {
  for (const n of [3, 4, 7]) {
    const seen = new Set();
    for (let id = 0; id < caseCount(n); id++) {
      const cards = decodeCase(id, n);
      assert.equal(new Set(cards.map(([c]) => c)).size, 3);
      assert.equal(encodeCase(cards, n), id);
      seen.add(cards.map(([c, r]) => `${c}${r ? "r" : "u"}`).join("."));
    }
    assert.equal(seen.size, n * (n - 1) * (n - 2) * 8);
  }
  assert.throws(() => decodeCase(caseCount(), 78));
  assert.throws(() => encodeCase([[1, false], [1, true], [2, false]]));
});
test("Rust runner matches independent decoding and the checked native/WASM fixtures", () => {
  const ids = deckIds();
  const fixtures = JSON.parse(readFileSync("tests/fixtures/readings.json", "utf8"));
  for (const f of fixtures) {
    const caseId = encodeCase(f.input.cards.map((c) => [ids.indexOf(c.cardId), c.orientation === "reversed"]));
    const [line] = batch(["--start", String(caseId), "--end", String(caseId + 1)]);
    const k = CONTEXTS.findIndex((c) => c.topic === f.input.context.topic && c.intent === f.input.context.intent);
    assert.deepEqual(line.plans[k], f.plan, f.label);
  }
  // explicit case list, edges, and cooperative errors
  const edge = batch(["--cases-file", (() => { const p = join(tmp(), "c.txt"); writeFileSync(p, "0\n7\n3651647\n"); return p; })()]);
  assert.deepEqual(edge.map((e) => e.case), [0, 7, 3651647]);
  assert.equal(spawnSync(BIN, ["batch", "--semantics", packs.paths.semantics, "--rules", packs.paths.rules, "--start", "0", "--end", "3651649"]).status, 2);
});
test("CSV writer and independent parser round-trip hostile fields at every split point", () => {
  const rows = [["a,b", 'say "hi"', "line1\nline2", "crlf\r\nrow", "=SUM(A1)", "+1", "-1", "@x", "ünï ✓ 「」", "", "tail"], ["", "", "", "", "", "", "", "", "", "", ""]];
  const text = rows.map(csvLine).join("");
  for (let cut = 0; cut <= text.length; cut++) {
    const got = [];
    const p = new CsvParser((r) => got.push(r));
    p.push(text.slice(0, cut)); p.push(text.slice(cut)); p.end();
    assert.deepEqual(got, rows);
  }
  assert.throws(() => { const p = new CsvParser(() => {}); p.push('"open'); p.end(); });
});
test("toy export: exact counts, shared case order, checksums, tamper detection, reviewer copies", () => {
  const out = tmp();
  const r = run(["full", "--out", out, "--deck-size", "6", "--chunk-size", "250", "--jobs", "2", "--reviewer-copies"]);
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
  assert.equal(m.state, "toy-complete");
  assert.equal(m.expectedRows, 6 * 5 * 4 * 8 * 12);
  assert.equal(m.actualRows, m.expectedRows);
  assert.equal(m.validation.humanEditorialApproval, false);
  const ids = deckIds(6);
  const parsed = {};
  for (const c of CONTEXTS) {
    const f = m.files[c.name];
    assert.equal(sha256(readFileSync(join(out, f.path))), f.sha256);
    const recs = [];
    const p = new CsvParser((x) => recs.push(x));
    p.push(gunzipSync(readFileSync(join(out, f.path))).toString("utf8")); p.end();
    assert.deepEqual(recs[0], COLUMNS);
    assert.equal(recs.length - 1, 960);
    parsed[c.name] = recs.slice(1);
  }
  for (let i = 0; i < 960; i++) {
    const cards = decodeCase(i, 6);
    for (const c of CONTEXTS) {
      const row = parsed[c.name][i];
      assert.equal(row[0], String(i));
      assert.deepEqual([row[3], row[6], row[9]], cards.map(([x]) => ids[x]));
    }
  }
  // review sets: identical case lists across all 12 files
  const review = CONTEXTS.map((c) => readFileSync(join(out, `${c.name}-review.csv`), "utf8"));
  const caseLists = review.map((t) => { const recs = []; const p = new CsvParser((x) => recs.push(x[0])); p.push(t); p.end(); return recs.slice(1).join(","); });
  assert.equal(new Set(caseLists).size, 1);
  const reviewer = readFileSync(join(out, "reviewer", "work-action-review.reviewer.csv"), "utf8").split("\n")[0];
  assert.match(reviewer, /review_reasons,reviewer_status,reviewer_comment\s*$/);
  assert.equal(run(["validate", "--out", out, "--deck-size", "6", "--chunk-size", "250"]).status, 0);
  // tamper: flip one byte in the middle of a compressed file
  const victim = join(out, m.files["growth-action"].path);
  const buf = readFileSync(victim); buf[Math.floor(buf.length / 2)] ^= 0xff; writeFileSync(victim, buf);
  const bad = run(["validate", "--out", out, "--deck-size", "6", "--chunk-size", "250"]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /growth-action/);
  rmSync(out, { recursive: true });
});
test("SIGKILL mid-run resumes without gaps or duplicates and refuses mismatched checkpoints", async () => {
  const reference = tmp(), killed = tmp();
  const args = (out) => ["--import", "tsx", "scripts/reading-export/cli.mjs", "full", "--out", out, "--deck-size", "10", "--chunk-size", "300", "--jobs", "2", "--allow-dirty"];
  assert.equal(spawnSync("node", args(reference), { encoding: "utf8" }).status, 0);
  const child = spawn("node", args(killed), { stdio: "ignore" });
  const done = () => (existsSync(join(killed, ".export-work/chunks")) ? readdirSync(join(killed, ".export-work/chunks")).filter((f) => f.endsWith(".json")).length : 0);
  const t0 = Date.now();
  while (done() < 4 && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
  child.kill("SIGKILL");
  await new Promise((r) => child.on("close", r));
  await new Promise((r) => setTimeout(r, 1500)); // orphaned workers exit when their parent is gone
  assert.ok(done() >= 4 && done() < 20, `interrupted after ${done()} of 20 chunks`);
  assert.equal(existsSync(join(killed, "manifest.json")), false, "no manifest before completion");
  assert.deepEqual(readdirSync(killed).filter((f) => f.endsWith(".csv.gz")), [], "no logical file before assembly");
  // a different chunk size must not silently reuse checkpoints
  const mismatch = spawnSync("node", [...args(killed).slice(0, -1).map((a) => (a === "300" ? "400" : a)), "--allow-dirty"], { encoding: "utf8" });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /EXPORT_CHECKPOINT_MISMATCH/);
  const resumed = spawnSync("node", [...args(killed).map((a) => (a === "full" ? "resume" : a))], { encoding: "utf8" });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.match(resumed.stderr, /verified and reused/);
  for (const c of CONTEXTS) {
    const a = readFileSync(join(reference, `${c.name}.csv.gz`)), b = readFileSync(join(killed, `${c.name}.csv.gz`));
    assert.equal(sha256(a), sha256(b), c.name);
  }
  rmSync(reference, { recursive: true }); rmSync(killed, { recursive: true });
});
