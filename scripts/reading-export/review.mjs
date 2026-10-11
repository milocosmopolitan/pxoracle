// Deterministic representative case selection, reading-content inventory, and reviewer copies.
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CONTEXTS, COLUMNS, HEADER_LINE, csvLine, deckIds, decodeCase, encodeCase, caseCount, rowFromPlan, loadPacks, FULL_DECK, ROOT } from "./common.mjs";
import { BINARY } from "./exporter.mjs";

/** Runs the production Rust scan (context-independence is asserted inside the runner). */
export function runScan(packs, deckSize, { start = 0, end = null } = {}) {
  const args = ["scan", "--semantics", packs.paths.semantics, "--rules", packs.paths.rules, "--deck-size", String(deckSize)];
  if (end !== null) args.push("--start", String(start), "--end", String(end));
  return JSON.parse(execFileSync(BINARY, args, { encoding: "utf8", maxBuffer: 1 << 30 }));
}
const maskClass = (m) => (m === 0 ? "upright" : m === 7 ? "reversed" : "mixed");

/**
 * Coverage obligations (all derived from the production scan, never from re-implemented rules):
 *  C1 every card x orientation x position appears (rotation covers 3x78 each for all-upright and all-reversed)
 *  C2 every observed relation signature (rule ids + participating positions) is represented by its first
 *     all-upright, all-reversed and mixed-orientation case, when such cases exist
 *  C3 fallback is represented in each orientation class
 *  C4 each rule is reported reachable/unreachable; priority ties, priority conflicts, kinds and the
 *     repetition / complement / tension classes are labelled from the observed (primary, secondary) pairs
 * Reasons are per case and independent of context, so all 12 review files use one case set.
 */
export function selectReviewCases({ scan, packs, deckSize }) {
  const n = deckSize;
  const reasons = new Map();
  const add = (id, why) => { if (!reasons.has(id)) reasons.set(id, new Set()); reasons.get(id).add(why); };
  const half = Math.floor(n / 3); // offset keeps the three cards distinct for every rotation
  const shift = n % 3 === 0 ? half + 1 : half;
  for (const [mask, label] of [[0, "upright"], [7, "reversed"]])
    for (let k = 0; k < n; k++) {
      const trio = [k, (k + shift) % n, (k + 2 * shift) % n];
      if (new Set(trio).size !== 3) continue;
      add(encodeCase(trio.map((c, i) => [c, ((mask >> i) & 1) === 1]), n), `card-coverage:${label}`);
    }
  // Mixed orientation: every card appears reversed in every position with other cards upright, and vice versa.
  for (let k = 0; k < n; k++)
    for (let pos = 0; pos < 3; pos++) {
      const trio = [k, (k + shift) % n, (k + 2 * shift) % n];
      if (new Set(trio).size !== 3) continue;
      const rev = trio.map((c, i) => i === pos);
      add(encodeCase(trio.map((c, i) => [c, rev[i]]), n), `card-coverage:mixed-single-reversed-p${pos + 1}`);
    }
  const rulesById = new Map(packs.rules.rules.map((r) => [r.id, r]));
  const seenRules = new Map(packs.rules.rules.map((r) => [r.id, { any: 0, primary: 0, signatures: 0 }]));
  const classes = { repetition: 0, complement: 0, tension: 0, ties: 0, priorityConflicts: 0, singles: 0, fallback: 0 };
  const sigRows = [];
  for (const s of scan.signatures) {
    const parts = s.signature === "fallback" ? [] : s.signature.split("|").map((p) => /^(.*?)\[(.*)\]$/.exec(p));
    const ids = parts.map((m) => m[1]);
    const tags = [];
    if (!parts.length) { tags.push("fallback"); classes.fallback += s.count; }
    ids.forEach((id, i) => {
      const e = seenRules.get(id); e.any += s.count; if (i === 0) e.primary += s.count; if (i === 0) e.signatures++;
      if (i === 0) classes[rulesById.get(id).kind] += s.count;
    });
    if (ids.length === 1) { tags.push("single-relation"); classes.singles += s.count; }
    if (ids.length === 2) {
      const [a, b] = ids.map((id) => rulesById.get(id));
      if (a.priority === b.priority) { tags.push("priority-tie-break-by-id"); classes.ties += s.count; }
      else { tags.push("priority-ordered"); classes.priorityConflicts += s.count; }
      tags.push(`${a.kind}+${b.kind}`);
    }
    sigRows.push({ ...s, ids, tags });
  }
  // Tier 1: every observed ordered rule pair gets its first upright, all-reversed and mixed case.
  // Tier 2: every remaining (rule pair x participating positions) signature gets one case, in whatever orientation class came first.
  const byPair = new Map();
  for (const s of sigRows) { const k = s.ids.join("|") || "fallback"; (byPair.get(k) ?? byPair.set(k, []).get(k)).push(s); }
  const chosenSig = new Set();
  for (const [pair, list] of byPair)
    ["upright", "reversed", "mixed"].forEach((cls, i) => {
      const hit = list.map((s) => [s.first[i], s]).filter(([id]) => id !== null).sort((a, b) => a[0] - b[0])[0];
      if (!hit) return;
      add(hit[0], `relation-pair:${pair}:${cls}`);
      hit[1].tags.forEach((t) => add(hit[0], `class:${t}`));
      chosenSig.add(hit[1].signature);
    });
  for (const s of sigRows) {
    if (chosenSig.has(s.signature)) continue;
    const id = s.first.filter((x) => x !== null).sort((a, b) => a - b)[0];
    add(id, `relation-positions:${s.signature.replaceAll(" ", "")}`);
    s.tags.forEach((t) => add(id, `class:${t}`));
  }
  const cases = [...reasons.keys()].sort((a, b) => a - b);
  const unreachable = [...seenRules].filter(([, v]) => v.any === 0).map(([id]) => id);
  const unreachableAsPrimary = [...seenRules].filter(([, v]) => v.any > 0 && v.primary === 0).map(([id]) => id);
  return {
    cases,
    reasons: Object.fromEntries(cases.map((c) => [c, [...reasons.get(c)].sort()])),
    coverage: {
      deckSize, scannedCases: scan.cases, signatures: scan.signatures.length, selectedCases: cases.length,
      rules: Object.fromEntries(seenRules), unreachableRules: unreachable, rulesNeverPrimary: unreachableAsPrimary,
      classCaseCounts: classes,
      cardOrientationPositionCombos: n * 2 * 3,
    },
  };
}
/** Verifies the selected cases really cover every card x orientation x position. */
export function cardCoverage(cases, deckSize) {
  const seen = new Set();
  for (const id of cases) decodeCase(id, deckSize).forEach(([c, r], p) => seen.add(`${c}.${r}.${p}`));
  return { covered: seen.size, required: deckSize * 2 * 3 };
}
/** Renders chosen cases through the batch runner (explicit case list; no per-case process). */
export async function renderCases({ cases, packs, deckSize, outDir, suffix = "-review.csv", extra = null }) {
  mkdirSync(outDir, { recursive: true });
  const listFile = join(outDir, ".cases.txt");
  writeFileSync(listFile, cases.join("\n") + "\n");
  const child = spawn(BINARY, ["batch", "--semantics", packs.paths.semantics, "--rules", packs.paths.rules, "--cases-file", listFile, "--deck-size", String(deckSize)], { stdio: ["ignore", "pipe", "inherit"] });
  const out = CONTEXTS.map(() => []);
  let i = 0, pending = "";
  for await (const chunk of child.stdout.setEncoding("utf8")) {
    pending += chunk;
    let nl, start = 0;
    while ((nl = pending.indexOf("\n", start)) >= 0) {
      const o = JSON.parse(pending.slice(start, nl)); start = nl + 1;
      if (o.case !== cases[i]) throw new Error("EXPORT_ORDER review");
      o.plans.forEach((plan, k) => out[k].push(rowFromPlan(o.case, plan, packs.prose)));
      i++;
    }
    pending = pending.slice(start);
  }
  if (i !== cases.length) throw new Error("EXPORT_REVIEW runner ended early");
  return out; // [context][row] -> fields
}
export function writeReview({ rows, outDir, reasons }) {
  const names = {};
  CONTEXTS.forEach((c, k) => {
    const p = join(outDir, `${c.name}-review.csv`);
    writeFileSync(p, HEADER_LINE + rows[k].map(csvLine).join(""));
    names[c.name] = p;
  });
  return names;
}
const SAFE = /^[=+\-@\t\r]/;
/** Reviewer copies: optional spreadsheet-neutralised cells (leading apostrophe) + reviewer columns. Canonical files stay untouched. */
export function writeReviewerCopies({ rows, outDir, reasons, cases }) {
  mkdirSync(outDir, { recursive: true });
  let escaped = 0;
  CONTEXTS.forEach((c, k) => {
    const head = [...COLUMNS, "review_reasons", "reviewer_status", "reviewer_comment"];
    const body = rows[k].map((f, i) => csvLine([...f.map((v) => (SAFE.test(v) ? (escaped++, "'" + v) : v)), reasons[cases[i]].join(";"), "", ""]));
    writeFileSync(join(outDir, `${c.name}-review.reviewer.csv`), csvLine(head) + body.join(""));
  });
  return { escapedCells: escaped };
}
/** reading-content.csv: every authored string with usage derived from the semantic/rule reference graph. */
export function buildContentInventory(packs) {
  const strings = packs.prose.strings;
  const use = new Map(); // id -> {cols:Set, kinds:Set, refs:number}
  const touch = (id, col, kind) => { const e = use.get(id) ?? { cols: new Set(), kinds: new Set(), refs: 0 }; e.cols.add(col); e.kinds.add(kind); e.refs++; use.set(id, e); };
  for (const [key, m] of Object.entries(packs.semantics.meanings)) {
    touch(m.coreRef, "position_N_text", "card-core");
    touch(m.resourceRef, "overall_text", "card-resource");
    touch(m.difficultyRef, "overall_text", "card-difficulty");
    touch(m.actionRef, "action_text", "card-action-fallback");
    touch(m.questionRef, "question_text", "card-question-fallback");
    for (const r of Object.values(m.topicRefs)) touch(r, "overall_text;position_N_text", "topic-clause");
    for (const r of Object.values(m.roleRefs)) touch(r, "overall_text;position_N_text", "role-clause");
  }
  for (const rule of packs.rules.rules) {
    touch(rule.relationRef, "overall_text;relation_text", `relation-${rule.kind}`);
    for (const r of Object.values(rule.actionRefs).flatMap(Object.values)) touch(r, "action_text", `rule-action-${rule.kind}`);
    for (const r of Object.values(rule.questionRefs).flatMap(Object.values)) touch(r, "question_text", `rule-question-${rule.kind}`);
  }
  for (const id of Object.keys(strings)) {
    if (/^(flow|evidence|fallback)\./.test(id)) touch(id, "overall_text", "flow-template");
    if (id.startsWith("name.")) touch(id, "card_N_name", "card-name");
  }
  const header = ["string_id", "text", "usage_category", "output_columns", "reference_count", "content_version", "semantics_version", "rules_version"];
  const lines = Object.keys(strings).sort().map((id) => {
    const u = use.get(id);
    return csvLine([id, strings[id], u ? [...u.kinds].sort().join(";") : "unreferenced", u ? [...u.cols].sort().join(";") : "", String(u?.refs ?? 0), packs.versions.content, packs.versions.semantics, packs.versions.rules]);
  });
  return { text: csvLine(header) + lines.join(""), unreferenced: Object.keys(strings).filter((id) => !use.has(id)), total: Object.keys(strings).length, dangling: [...use.keys()].filter((id) => !(id in strings)) };
}
