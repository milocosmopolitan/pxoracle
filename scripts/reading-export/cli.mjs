#!/usr/bin/env node
// Offline exhaustive three-card reading export (epic #51). Run via: npm run reading-export -- <command> [options]
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  CONTEXTS, ENUMERATION, EXPORT_SCHEMA, FULL_DECK, COLUMNS, TEXT_COLUMNS, caseCount, deckHash, loadPacks, sha256, sourceInfo, ROOT,
} from "./common.mjs";
import {
  BINARY, DEFAULT_CHUNK, assemble, buildBinary, defaultJobs, makeIdentity, readJson, runChunks, toolInfo, diskPreflight,
} from "./exporter.mjs";
import { buildContentInventory, cardCoverage, renderCases, runScan, selectReviewCases, writeReview, writeReviewerCopies } from "./review.mjs";
import { verifyExport, verifyReview } from "./verify.mjs";

const USAGE = `Usage: npm run reading-export -- <command> --out DIR [options]
Commands
  build                       Build the Rust batch runner (cargo --locked --profile export)
  sample   --out DIR [--start N --end M]   Export a case range (default 0..100000). Never a full-export claim.
  review   --out DIR          Scan, select representative cases, write 12 <topic>-<intent>-review.csv + reading-content.csv
  full     --out DIR          Export all 43,819,776 rows, assemble, review, validate, then write manifest.json
  resume   --out DIR          Continue an interrupted full/sample run (same options as the original run)
  validate --out DIR          Independently re-validate an assembled export; promotes it to manifest.json when it passes
  benchmark --out DIR [--start N --end M]  Fixed-range timing, RSS, raw/gzip size, extrapolation
Options
  --chunk-size N (default ${DEFAULT_CHUNK})  --jobs N (default ${defaultJobs()})  --allow-dirty  --reset-work  --cleanup
  --start N --end M  case range (canonical case_id, end exclusive)  --deck-size N  tiny-deck test mode (<78: scope "toy")
  --allow-low-disk  --reviewer-copies   write review/reviewer/*.csv with reviewer_status/comment columns`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" }, start: { type: "string" }, end: { type: "string" }, "chunk-size": { type: "string" }, jobs: { type: "string" },
    "deck-size": { type: "string" }, "allow-dirty": { type: "boolean" }, "reset-work": { type: "boolean" }, cleanup: { type: "boolean" },
    "allow-low-disk": { type: "boolean" }, "reviewer-copies": { type: "boolean" }, "stop-file": { type: "string" },
  },
});
const cmd = positionals[0];
const log = (...a) => console.error(...a);
const die = (m) => { console.error(m); process.exit(1); };
if (!cmd || cmd === "help") { console.log(USAGE); process.exit(cmd ? 0 : 1); }
const deckSize = Number(o["deck-size"] ?? FULL_DECK);
const total = caseCount(deckSize);
const chunkSize = Number(o["chunk-size"] ?? DEFAULT_CHUNK);
const jobs = Number(o.jobs ?? defaultJobs());
const atomic = (p, t) => { writeFileSync(p + ".tmp", t); renameSync(p + ".tmp", p); };

if (cmd === "build") { buildBinary(); process.exit(0); }
if (!o.out) die("--out DIR is required\n" + USAGE);
const out = resolve(o.out);
if (!existsSync(BINARY)) buildBinary();
const packs = loadPacks();
const source = sourceInfo();
if (source.dirty && !o["allow-dirty"] && ["full", "resume"].includes(cmd))
  die(`Working tree has uncommitted changes in export sources (${source.dirtyFiles.join(", ")}). Commit them or pass --allow-dirty (the dirty digest is recorded and part of checkpoint identity).`);

const rangeDefault = cmd === "sample" || cmd === "benchmark" ? [0, Math.min(100_000, total)] : [0, total];
const start = Number(o.start ?? rangeDefault[0]), end = Number(o.end ?? rangeDefault[1]);
if (!(start >= 0 && end <= total && start < end)) die(`invalid range ${start}..${end} for ${total} cases`);
const scope = deckSize < FULL_DECK ? "toy" : start === 0 && end === total ? "full" : "sample";
const manifestPath = join(out, "manifest.json");

const rel = (p) => p.slice(out.length + 1);
const fileInfo = (p) => ({ path: rel(p), bytes: statSync(p).size, sha256: sha256(readFileSync(p)) });

async function doReview({ identity, work }) {
  const t0 = Date.now();
  const scanPath = join(work, `scan-${identity.hash.slice(0, 12)}-${start}-${end}.json`);
  let scan;
  if (existsSync(scanPath)) scan = readJson(scanPath);
  else { log("scanning production relations over the case range..."); scan = runScan(packs, deckSize, { start, end }); atomic(scanPath, JSON.stringify(scan)); }
  const sel = selectReviewCases({ scan, packs, deckSize });
  const cases = sel.cases.filter((c) => c >= start && c < end);
  const cov = cardCoverage(cases, deckSize);
  const rows = await renderCases({ cases, packs, deckSize, outDir: work });
  mkdirSync(out, { recursive: true });
  const names = writeReview({ rows, outDir: out });
  let reviewer = null;
  if (o["reviewer-copies"]) reviewer = writeReviewerCopies({ rows, outDir: join(out, "reviewer"), reasons: sel.reasons, cases });
  const content = buildContentInventory(packs);
  writeFileSync(join(out, "reading-content.csv"), content.text);
  const caseDoc = { selection: "card-rotation + relation-signature coverage (see scripts/reading-export/review.mjs)", enumeration: ENUMERATION, deckSize, caseRange: { start, end }, cases, reasons: Object.fromEntries(cases.map((c) => [c, sel.reasons[c]])) };
  atomic(join(out, "review-cases.json"), JSON.stringify(caseDoc, null, 1));
  const v = await verifyReview({ files: names, cases, deckSize, jobs });
  if (!v.ok) die("review validation failed:\n" + v.problems.join("\n"));
  log(`review: ${cases.length} cases x 12 contexts, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { cases, coverage: { ...sel.coverage, ...(scope === "full" ? {} : { unobservedRulesInRange: sel.coverage.unreachableRules, unreachableRules: null, rulesNeverPrimary: null }), cardOrientationPositionCovered: cov.covered, cardOrientationPositionRequired: cov.required, reachabilityScope: scope === "full" ? "complete-enumeration" : `case range ${start}..${end} only; unreachable-rule claims do not apply` }, content: { unreferencedStrings: content.unreferenced, danglingReferences: content.dangling, total: content.total }, reviewerCopies: reviewer, files: Object.fromEntries(Object.entries(names).map(([k, p]) => [k, fileInfo(p)])), contentFile: fileInfo(join(out, "reading-content.csv")), caseFile: fileInfo(join(out, "review-cases.json")), reviewValidation: { ok: v.ok, rows: v.rows } };
}
const mdTable = (rows) => rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
function writeReports({ ver, review, manifest }) {
  mkdirSync(join(out, "reports"), { recursive: true });
  atomic(join(out, "reports", "validation-report.json"), JSON.stringify({ manifestState: manifest.state, ...ver, review }, null, 1));
  const ruleRows = Object.entries(ver.rules).sort((a, b) => b[1].any - a[1].any).map(([id, v]) => [id, v.primary, v.any]);
  const unreach = review.coverage.unreachableRules ?? [];
  const sec = ver.sections ?? {};
  let md = `# Reading export validation report\n\n- State: **${manifest.state}** (scope \`${manifest.scope}\`, cases ${manifest.caseRange.start}..${manifest.caseRange.end - 1})\n- Rows per context: ${ver.rows.toLocaleString("en-US")} x 12 = ${(ver.rows * 12).toLocaleString("en-US")}\n- Source: ${manifest.source.commit}${manifest.source.dirty ? ` (dirty ${manifest.source.dirtyDigest})` : " (clean)"}\n- Automated gates passed: ${ver.ok ? "yes" : "NO"}\n- Production parity: ${ver.parity.sampled} sampled cases x 12 contexts, ${ver.parity.mismatches} mismatches; ${ver.parity.fixtureCases} native/WASM fixture cases, ${ver.parity.fixtureMismatches} mismatches\n- **Human editorial approval: NOT performed.** Automated checks do not approve sentences.\n\n## Coverage status\n\n| Claim | Status |\n| --- | --- |\n| Full export verified | ${manifest.scope === "full" ? "yes, all rows" : "NO - scope is " + manifest.scope} |\n| Review set | ${review.cases.length} cases, card x orientation x position ${review.coverage.cardOrientationPositionCovered}/${review.coverage.cardOrientationPositionRequired} |\n| Unreachable rules | ${review.coverage.reachabilityScope.startsWith("complete") ? (unreach.join(", ") || "none") : "not determined (partial range); rules unobserved in this range: " + (review.coverage.unobservedRulesInRange.join(", ") || "none")} |\n\n## Rule frequencies (identical across all 12 contexts)\n\nFallback rows: ${ver.fallbackRows.toLocaleString("en-US")} (${((100 * ver.fallbackRows) / ver.rows).toFixed(2)}%)\n\n| Rule | As primary | In any relation |\n| --- | ---: | ---: |\n${mdTable(ruleRows)}\n\n## Cross-context text differences\n\nFor each section, how many cases yield N distinct texts across the 12 contexts (identical text is legitimate, not an error).\n\n`;
  for (const [c, v] of Object.entries(sec)) md += `**${c}**: ${Object.entries(v.distinctPerCaseHistogram).map(([d, n]) => `${d} distinct: ${n.toLocaleString("en-US")}`).join(", ")}\n\n`;
  md += `## Distinct texts per context file (hash-based)\n\n| Context | ${TEXT_COLUMNS.join(" | ")} |\n| --- |${TEXT_COLUMNS.map(() => " ---: |").join("")}\n${ver.perContext.map((p) => `| ${p.context} | ${TEXT_COLUMNS.map((c) => p.distinct[c].toLocaleString("en-US")).join(" | ")} |`).join("\n")}\n\n## Spreadsheet-formula-leading fields in canonical files\n\n${ver.perContext.every((p) => !Object.keys(p.formulaLeading).length) ? "None. Canonical text needs no escaping." : ver.perContext.map((p) => `${p.context}: ${JSON.stringify(p.formulaLeading)}`).join("\n")}\n\nReviewer copies (\`--reviewer-copies\`) prefix such cells with an apostrophe; canonical files are never altered.\n`;
  atomic(join(out, "reports", "validation-report.md"), md);
}
async function finalize({ run, review }) {
  const { work, plan, records, identity } = run;
  log("assembling logical files...");
  const files = await assemble({ out, work, plan, records });
  atomic(join(out, "assembly.json"), JSON.stringify({ state: "assembled-unvalidated", identityHash: identity.hash, files }, null, 1));
  return files;
}
async function validateAndPromote({ files, identity, review, tools, extra = {} }) {
  const ver = await verifyExport({ dir: out, files: Object.fromEntries(CONTEXTS.map((c) => [c.name, join(out, files[c.name].path)])), start, end, deckSize, chunkSize, jobs, expectedFiles: files });
  if (!ver.ok) {
    atomic(join(out, "validation-failed.json"), JSON.stringify(ver.problems, null, 1));
    die("VALIDATION FAILED (no manifest written):\n" + ver.problems.join("\n"));
  }
  for (const c of CONTEXTS) { files[c.name].rawBytes = ver.perContext.find((p) => p.context === c.name).rawBytes; files[c.name].rawSha256 = ver.perContext.find((p) => p.context === c.name).rawSha256; }
  const manifest = {
    manifestVersion: 1, exportSchema: EXPORT_SCHEMA,
    state: scope === "full" ? "complete" : scope === "toy" ? "toy-complete" : "partial-sample", scope, completedAt: new Date().toISOString(),
    source, tools, versions: packs.versions,
    inputs: { semanticsSha256: packs.hashes.semantics, rulesSha256: packs.hashes.rules, proseSha256: packs.hashes.prose, deckSha256: deckHash(deckSize), columnsSha256: sha256(COLUMNS.join(",")), columns: COLUMNS },
    enumeration: { name: ENUMERATION, deckSize, casesPerContext: total, contexts: CONTEXTS.map((c) => c.name), caseId: "rank(ordered distinct triple, lexicographic by deck index) * 8 + orientation mask; mask bit i (1<<i) = card in position i+1 reversed" },
    caseRange: { start, end }, chunkSize, expectedRows: (end - start) * 12, actualRows: ver.rows * 12,
    files, review: { cases: review.cases.length, files: review.files, contentFile: review.contentFile, caseFile: review.caseFile, coverage: review.coverage },
    validation: { ok: true, parity: ver.parity, fallbackRows: ver.fallbackRows, humanEditorialApproval: false },
    ...extra,
  };
  writeReports({ ver, review, manifest });
  atomic(manifestPath, JSON.stringify(manifest, null, 1));
  return manifest;
}
async function exportRun() {
  if (existsSync(manifestPath)) {
    const m = readJson(manifestPath);
    if (m.caseRange.start === start && m.caseRange.end === end && m.enumeration.deckSize === deckSize && m.source.commit === source.commit && m.source.dirtyDigest === source.dirtyDigest && m.inputs.proseSha256 === packs.hashes.prose)
      die(`${out} already holds a ${m.state} export for this range; run 'validate' to re-check it.`);
    die(`${out}/manifest.json belongs to a different export (state ${m.state}, cases ${m.caseRange.start}..${m.caseRange.end}); use a new --out directory.`);
  }
  if (cmd === "resume" && !existsSync(join(out, ".export-work"))) die("nothing to resume: no .export-work checkpoints in " + out);
  const run = await runChunks({ out, start, end, deckSize, chunkSize, jobs, packs, source, resetWork: o["reset-work"], log, stopFile: o["stop-file"] ?? null, allowLowDisk: o["allow-low-disk"] });
  const review = await doReview({ identity: run.identity, work: run.work });
  const files = await finalize({ run });
  const manifest = await validateAndPromote({ files, identity: run.identity, review, tools: toolInfo(), extra: { run: { chunksRendered: run.rendered, chunksTotal: run.plan.length, seconds: run.seconds } } });
  if (o.cleanup) { rmSync(run.work, { recursive: true, force: true }); log("removed .export-work checkpoints"); }
  log(`${manifest.state}: ${manifest.actualRows.toLocaleString("en-US")} rows verified -> ${out}`);
}
if (cmd === "sample" || cmd === "full" || cmd === "resume") await exportRun();
else if (cmd === "review") {
  const id = makeIdentity({ deckSize, chunkSize, packs, source });
  const work = join(out, ".export-work"); mkdirSync(work, { recursive: true });
  const r = await doReview({ identity: id, work });
  atomic(join(out, "review-report.json"), JSON.stringify(r.coverage, null, 1));
  log(`unreachable rules: ${r.coverage.unreachableRules?.join(", ") || (r.coverage.unreachableRules ? "none" : "n/a (partial range)")}`);
} else if (cmd === "validate") {
  const src = existsSync(manifestPath) ? readJson(manifestPath) : existsSync(join(out, "assembly.json")) ? readJson(join(out, "assembly.json")) : die("no manifest.json or assembly.json in " + out);
  if (!existsSync(manifestPath)) {
    // promote: assembled but not yet validated (e.g. validation was interrupted)
    const id = makeIdentity({ deckSize, chunkSize, packs, source });
    if (id.hash !== src.identityHash) die("assembly.json belongs to different pack/source/enumeration; refusing to promote");
    const caseDoc = readJson(join(out, "review-cases.json"));
    const review = await doReview({ identity: id, work: join(out, ".export-work") });
    const m = await validateAndPromote({ files: src.files, identity: id, review, tools: toolInfo() });
    log(`${m.state}: promoted`);
  } else {
    const ver = await verifyExport({ dir: out, files: Object.fromEntries(CONTEXTS.map((c) => [c.name, join(out, src.files[c.name].path)])), start: src.caseRange.start, end: src.caseRange.end, deckSize: src.enumeration.deckSize, chunkSize: src.chunkSize, jobs, expectedFiles: src.files });
    const rv = await verifyReview({ files: Object.fromEntries(CONTEXTS.map((c) => [c.name, join(out, src.review.files[c.name].path)])), cases: readJson(join(out, src.review.caseFile.path)).cases, deckSize: src.enumeration.deckSize, jobs });
    const bad = [...ver.problems, ...rv.problems];
    for (const f of [...Object.values(src.review.files), src.review.contentFile, src.review.caseFile]) if (fileInfo(join(out, f.path)).sha256 !== f.sha256) bad.push(`checksum mismatch ${f.path}`);
    if (bad.length) die("VALIDATION FAILED:\n" + bad.join("\n"));
    log(`validated: ${ver.rows * 12} rows, manifest state ${src.state}`);
  }
} else if (cmd === "benchmark") {
  const { benchmark } = await import("./benchmark.mjs");
  await benchmark({ out, start, end, deckSize, chunkSize, jobs, packs, source, log });
} else die(USAGE);
