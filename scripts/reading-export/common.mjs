// Shared definitions for the offline exhaustive reading export (issue #51).
// Case enumeration here is an INDEPENDENT implementation of the Rust CaseSpace so the validator can
// cross-check the Rust runner; interpretation and text always come from the production paths.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import reading from "../../apps/web/src/features/tarot/reading.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const EXPORT_SCHEMA = "reading-export.v1";
export const ENUMERATION = "ordered-distinct-triples.lex.v1";
export const FULL_DECK = 78;
export const GZIP_LEVEL = 6;
export const TOPICS = ["relationships", "work", "creativity", "growth"];
export const INTENTS = ["present", "crossroads", "action"];
export const CONTEXTS = TOPICS.flatMap((topic) =>
  INTENTS.map((intent) => ({ topic, intent, name: `${topic}-${intent}` })),
);
export const ROLES_BY_INTENT = {
  present: ["visible", "examination", "direction"],
  crossroads: ["values", "conditions", "checks"],
  action: ["foundation", "difficulty", "small_action"],
};
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export function deckIds(deckSize = FULL_DECK) {
  const ids = Array.from(
    { length: 22 },
    (_, i) => `major.${String(i).padStart(2, "0")}`,
  );
  for (const suit of ["wands", "cups", "swords", "pentacles"])
    for (let i = 1; i <= 14; i++)
      ids.push(`${suit}.${String(i).padStart(2, "0")}`);
  return ids.slice(0, deckSize);
}
export const caseCount = (n = FULL_DECK) => n * (n - 1) * (n - 2) * 8;

/** Rank-based decode; bit i of the mask (value 1<<i) means the card in position i+1 is reversed. */
export function decodeCase(caseId, n = FULL_DECK) {
  if (!Number.isInteger(caseId) || caseId < 0 || caseId >= caseCount(n))
    throw new Error(`EXPORT_CASE_RANGE ${caseId}`);
  const mask = caseId % 8;
  const rank = (caseId - mask) / 8;
  const a = Math.floor(rank / ((n - 1) * (n - 2)));
  const rest = rank % ((n - 1) * (n - 2));
  const bq = Math.floor(rest / (n - 2)),
    cq = rest % (n - 2);
  const b = bq + (bq >= a ? 1 : 0);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let c = cq;
  if (c >= lo) c++;
  if (c >= hi) c++;
  return [
    [a, (mask & 1) !== 0],
    [b, (mask & 2) !== 0],
    [c, (mask & 4) !== 0],
  ];
}
export function encodeCase(cards, n = FULL_DECK) {
  const [[a, ra], [b, rb], [c, rc]] = cards;
  if (new Set([a, b, c]).size !== 3 || [a, b, c].some((x) => x < 0 || x >= n))
    throw new Error("EXPORT_CASE_INPUT");
  const bq = b - (b > a ? 1 : 0),
    cq = c - (c > a ? 1 : 0) - (c > b ? 1 : 0);
  return ((a * (n - 1) + bq) * (n - 2) + cq) * 8 + (+ra | (+rb << 1) | (+rc << 2));
}

// ---------- CSV ----------
export const COLUMNS = [
  "case_id",
  "topic",
  "intent",
  ...[1, 2, 3].flatMap((i) => [
    `card_${i}_id`,
    `card_${i}_name`,
    `card_${i}_orientation`,
  ]),
  ...[1, 2, 3].flatMap((i) => [
    `position_${i}_role`,
    `position_${i}_role_label`,
    `position_${i}_lens`,
  ]),
  "overall_text",
  "relation_rule_ids",
  "relation_evidence",
  "relation_text",
  "fallback",
  "action_text",
  "question_text",
  "position_1_text",
  "position_2_text",
  "position_3_text",
  "engine_version",
  "semantics_version",
  "rules_version",
  "content_version",
  "export_schema_version",
];
export const TEXT_COLUMNS = [
  "overall_text",
  "relation_text",
  "action_text",
  "question_text",
  "position_1_text",
  "position_2_text",
  "position_3_text",
];
const NEEDS_QUOTE = /[",\r\n]/;
export const csvField = (v) =>
  NEEDS_QUOTE.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
export const csvLine = (fields) => fields.map(csvField).join(",") + "\n";
export const HEADER_LINE = csvLine(COLUMNS);

/** Incremental RFC 4180 parser (LF or CRLF record ends). Calls onRecord(string[]) per record. */
export class CsvParser {
  constructor(onRecord) {
    this.onRecord = onRecord;
    this.buf = "";
    this.record = [];
  }
  push(text) {
    this.buf = this.buf ? this.buf + text : text;
    const s = this.buf;
    let i = 0;
    for (;;) {
      // parse one field starting at i; stop (retain remainder) if the record is not complete yet
      if (i >= s.length) break;
      let field;
      let next;
      if (s.charCodeAt(i) === 34) {
        let j = i + 1,
          parts = "",
          start = j,
          closed = false;
        while (j < s.length) {
          const q = s.indexOf('"', j);
          if (q < 0) break;
          if (q + 1 >= s.length) break; // need lookahead
          if (s.charCodeAt(q + 1) === 34) {
            parts += s.slice(start, q + 1);
            j = start = q + 2;
            continue;
          }
          parts += s.slice(start, q);
          field = parts;
          next = q + 1;
          closed = true;
          break;
        }
        if (!closed) break;
      } else {
        let j = i;
        while (j < s.length) {
          const c = s.charCodeAt(j);
          if (c === 44 || c === 10 || c === 13) break;
          j++;
        }
        if (j >= s.length) break;
        field = s.slice(i, j);
        next = j;
      }
      const c = s.charCodeAt(next);
      if (c === 44) {
        this.record.push(field);
        i = next + 1;
      } else if (c === 10 || c === 13) {
        if (c === 13) {
          if (next + 1 >= s.length) break;
          if (s.charCodeAt(next + 1) !== 10) throw new Error("CSV_BARE_CR");
          next++;
        }
        this.record.push(field);
        const r = this.record;
        this.record = [];
        this.onRecord(r);
        i = next + 1;
      } else throw new Error("CSV_MALFORMED");
    }
    this.buf = s.slice(i);
  }
  end() {
    if (this.buf || this.record.length) throw new Error("CSV_TRUNCATED");
  }
}

// ---------- packs / source ----------
const git = (args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
export const SOURCE_PATHS = [
  "crates/pxoracle-tarot-reading",
  "content/tarot/reading",
  "apps/web/src/features/tarot/reading.ts",
  "scripts/reading-export",
  "Cargo.toml",
  "Cargo.lock",
];
/** Commit plus a digest of every modified/untracked relevant file, so dirty trees never look clean. */
export function sourceInfo() {
  const commit = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain", "-uall", "--", ...SOURCE_PATHS])
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ""))
    .sort();
  const h = createHash("sha256");
  for (const f of status) {
    const p = join(ROOT, f);
    h.update(f + "\0" + (existsSync(p) ? sha256(readFileSync(p)) : "deleted") + "\n");
  }
  return {
    commit,
    dirty: status.length > 0,
    dirtyFiles: status,
    dirtyDigest: status.length ? h.digest("hex") : null,
  };
}
export function loadPacks() {
  const base = join(ROOT, "content/tarot/reading");
  const paths = {
    semantics: join(base, "semantics.1.json"),
    rules: join(base, "rules.1.json"),
    prose: join(base, "reading.en.1.json"),
  };
  const bytes = Object.fromEntries(
    Object.entries(paths).map(([k, p]) => [k, readFileSync(p)]),
  );
  const pub = join(ROOT, "apps/web/public/content/reading/reading.en.1.json");
  if (existsSync(pub) && sha256(readFileSync(pub)) !== sha256(bytes.prose))
    throw new Error("EXPORT_PACK public prose copy differs from source");
  const prose = JSON.parse(bytes.prose);
  const semantics = JSON.parse(bytes.semantics);
  if (
    prose.schemaVersion !== 1 ||
    prose.version !== reading.READING_VERSIONS.content ||
    prose.locale !== "en" ||
    Object.values(prose.strings).some((s) => typeof s !== "string")
  )
    throw new Error("EXPORT_PACK prose");
  if (JSON.stringify(semantics.versions) !== JSON.stringify(reading.READING_VERSIONS))
    throw new Error("EXPORT_PACK versions");
  return {
    paths,
    prose,
    semantics,
    rules: JSON.parse(bytes.rules),
    hashes: Object.fromEntries(
      Object.entries(bytes).map(([k, b]) => [k, sha256(b)]),
    ),
    versions: semantics.versions,
  };
}
export const deckHash = (n = FULL_DECK) => sha256(deckIds(n).join("\n") + "\n");

// ---------- rows ----------
/** One CSV record from a production ReadingPlan, rendered by the production composeReading/renderPhrase. */
export function rowFromPlan(caseId, plan, pack) {
  const v = reading.composeReading(plan, pack);
  const relationText =
    v.fallbackText ??
    v.relations
      .map(
        (r) =>
          `${r.kindLabel} · ${r.cardNames.join(" / ")}. ${r.text} Cards ${r.cardNumbers.join(", ")}`,
      )
      .join("\n");
  const f = [
    String(caseId),
    plan.context.topic,
    plan.context.intent,
  ];
  for (const p of v.positions) f.push(p.cardId, p.cardName, p.orientation);
  for (const p of v.positions) f.push(p.role, p.roleLabel, p.lens);
  f.push(
    v.overall,
    plan.relations.map((r) => r.ruleId).join("|"),
    plan.relations
      .map((r) => `${r.kind}:${r.cardIndices.map((i) => i + 1).join("+")}`)
      .join("|"),
    relationText,
    String(plan.fallback),
    v.action,
    v.question,
    ...v.positions.map((p) => p.paragraphs.join("\n")),
    plan.versions.engine,
    plan.versions.semantics,
    plan.versions.rules,
    plan.versions.content,
    EXPORT_SCHEMA,
  );
  return f;
}
export { reading };
