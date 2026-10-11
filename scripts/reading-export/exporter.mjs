// Checkpointed chunk orchestration and atomic assembly for the exhaustive reading export.
import { spawn, execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, statfsSync,
  writeFileSync, createReadStream, createWriteStream, openSync, fsyncSync, closeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { gzipSync } from "node:zlib";
import {
  CONTEXTS, COLUMNS, HEADER_LINE, ENUMERATION, EXPORT_SCHEMA, FULL_DECK, GZIP_LEVEL, ROOT,
  caseCount, deckHash, loadPacks, sha256, sourceInfo,
} from "./common.mjs";
import { chunkName } from "./chunk-worker.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BINARY = join(ROOT, "target/export/reading-export");
export const DEFAULT_CHUNK = 50_000;
/** Measured steady-state upper bound used only for the disk preflight; `benchmark` reports real values. */
export const EST_GZ_BYTES_PER_ROW = 100; // measured ~83 B/row (999 B/case over 12 contexts)

const atomicWrite = (path, text) => {
  writeFileSync(path + ".tmp", text);
  const fd = openSync(path + ".tmp", "r+");
  try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(path + ".tmp", path);
};
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function buildBinary({ force = false } = {}) {
  execFileSync("cargo", ["build", "--locked", "--profile", "export", "-p", "pxoracle-tarot-reading", "--bin", "reading-export"], { cwd: ROOT, stdio: "inherit" });
  return BINARY;
}
export function toolInfo() {
  const rustc = execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim();
  return {
    node: process.version, zlib: process.versions.zlib, rustc,
    binarySha256: sha256(readFileSync(BINARY)), platform: `${process.platform}-${process.arch}`,
    gzipLevel: GZIP_LEVEL,
  };
}
export function makeIdentity({ deckSize, chunkSize, packs, source }) {
  const identity = {
    exportSchema: EXPORT_SCHEMA, enumeration: ENUMERATION, deckSize, chunkSize,
    deckSha256: deckHash(deckSize), columnsSha256: sha256(COLUMNS.join(",")),
    contexts: CONTEXTS.map((c) => c.name), gzipLevel: GZIP_LEVEL, zlib: process.versions.zlib,
    inputs: { semantics: packs.hashes.semantics, rules: packs.hashes.rules, prose: packs.hashes.prose },
    versions: packs.versions, sourceCommit: source.commit, dirtyDigest: source.dirtyDigest,
  };
  return { identity, hash: sha256(JSON.stringify(identity)) };
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** Opens (or creates) the work directory, refusing silent reuse of mismatched checkpoints. */
export function openWork(out, id, { resetWork = false } = {}) {
  const work = join(out, ".export-work");
  if (resetWork) rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "chunks"), { recursive: true });
  const idPath = join(work, "identity.json");
  if (existsSync(idPath)) {
    const old = readJson(idPath);
    if (old.hash !== id.hash) {
      const diff = Object.keys(id.identity).filter((k) => JSON.stringify(old.identity[k]) !== JSON.stringify(id.identity[k]));
      throw new Error(`EXPORT_CHECKPOINT_MISMATCH changed: ${diff.join(", ")}. Checkpoints in ${work} belong to a different pack/version/enumeration/source; rerun with --reset-work to discard them.`);
    }
  } else atomicWrite(idPath, JSON.stringify(id));
  const lock = join(work, "run.lock");
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    if (pid && alive(pid) && pid !== process.pid) throw new Error(`EXPORT_LOCKED by running pid ${pid}`);
  }
  writeFileSync(lock, String(process.pid));
  return { work, release: () => rmSync(lock, { force: true }) };
}
function chunkPlan(start, end, chunkSize) {
  const out = [];
  for (let i = Math.floor(start / chunkSize); i * chunkSize < end; i++)
    out.push({ index: i, from: Math.max(start, i * chunkSize), to: Math.min(end, (i + 1) * chunkSize) });
  return out;
}
async function hashFile(path) {
  const h = createHash("sha256");
  for await (const b of createReadStream(path)) h.update(b);
  return h.digest("hex");
}
/** A chunk is reusable only if its sidecar exists, covers exactly this range, and every member matches. */
async function chunkComplete(work, c, { verify }) {
  const rec = join(work, "chunks", `${chunkName(c.index)}.json`);
  if (!existsSync(rec)) return null;
  let r;
  try { r = readJson(rec); } catch { return null; }
  if (r.index !== c.index || r.from !== c.from || r.to !== c.to) return null;
  for (const ctx of CONTEXTS) {
    const m = r.contexts?.[ctx.name];
    const f = join(work, "chunks", ctx.name, `${chunkName(c.index)}.csv.gz`);
    if (!m || m.rows !== c.to - c.from || !existsSync(f) || statSync(f).size !== m.gzBytes) return null;
    if (verify && (await hashFile(f)) !== m.gzSha256) return null;
  }
  return r;
}
function cleanPartials(work) {
  for (const ctx of CONTEXTS) {
    const d = join(work, "chunks", ctx.name);
    if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith(".partial")) rmSync(join(d, f));
  }
  for (const f of readdirSync(join(work, "chunks"))) if (f.endsWith(".tmp")) rmSync(join(work, "chunks", f));
}
export function diskPreflight(out, rows, { log = console.error } = {}) {
  mkdirSync(out, { recursive: true });
  const s = statfsSync(out);
  const free = Number(s.bavail) * Number(s.bsize);
  // chunks + assembled copy coexist until cleanup
  const need = Math.ceil(rows * CONTEXTS.length * EST_GZ_BYTES_PER_ROW * 2);
  log(`disk preflight: free ${(free / 1e9).toFixed(1)} GB, estimated need ${(need / 1e9).toFixed(1)} GB (chunks + assembled copy)`);
  return { free, need, ok: free > need };
}
export async function runChunks({ out, start, end, deckSize, chunkSize, jobs, packs, source, resetWork, verifyChunks = true, log = console.error, stopFile = null, allowLowDisk = false }) {
  const id = makeIdentity({ deckSize, chunkSize, packs, source });
  const { work, release } = openWork(out, id, { resetWork });
  const pre = diskPreflight(out, end - start, { log });
  if (!pre.ok && !allowLowDisk) { release(); throw new Error(`EXPORT_DISK insufficient space (free ${pre.free}, need ~${pre.need}); pass --allow-low-disk to override`); }
  const plan = chunkPlan(start, end, chunkSize);
  cleanPartials(work);
  const todo = [], done = new Map();
  for (const c of plan) {
    const r = await chunkComplete(work, c, { verify: verifyChunks });
    if (r) done.set(c.index, r); else todo.push(c);
  }
  log(`chunks: ${plan.length} total, ${done.size} verified and reused, ${todo.length} to render`);
  const running = new Set();
  let failure = null, finished = 0;
  const t0 = Date.now();
  const launch = (c) => new Promise((resolve) => {
    const job = { dir: work, index: c.index, from: c.from, to: c.to, deckSize, binary: BINARY, stopFile, parentPid: process.pid };
    const child = spawn(process.execPath, ["--import", "tsx", join(HERE, "chunk-worker.mjs"), JSON.stringify(job)], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (b) => (err += b));
    running.add(child);
    child.on("close", async (code) => {
      running.delete(child);
      if (code !== 0) failure ??= new Error(`EXPORT_CHUNK ${c.index} [${c.from},${c.to}) failed: ${err.trim()}`);
      else {
        done.set(c.index, readJson(join(work, "chunks", `${chunkName(c.index)}.json`)));
        finished++;
        const el = (Date.now() - t0) / 1000;
        log(`chunk ${c.index} done (${finished}/${todo.length}) ${(finished * chunkSize / el).toFixed(0)} cases/s`);
      }
      resolve();
    });
  });
  const onSignal = () => { for (const ch of running) ch.kill("SIGKILL"); release(); process.exit(130); };
  process.once("SIGINT", onSignal); process.once("SIGTERM", onSignal);
  const queue = [...todo];
  const slots = Array.from({ length: Math.max(1, jobs) }, async () => {
    while (queue.length && !failure) await launch(queue.shift());
  });
  await Promise.all(slots);
  process.off("SIGINT", onSignal); process.off("SIGTERM", onSignal);
  release();
  if (failure) { for (const ch of running) ch.kill("SIGKILL"); throw failure; }
  const records = plan.map((c) => done.get(c.index));
  return { work, plan, records, identity: id, seconds: (Date.now() - t0) / 1000, rendered: todo.length };
}
/** Concatenates header + chunk members into the final logical <context>.csv.gz, verifying every member. */
export async function assemble({ out, work, plan, records, dest = out }) {
  mkdirSync(dest, { recursive: true });
  const header = gzipSync(HEADER_LINE, { level: GZIP_LEVEL });
  const files = {};
  const one = async (ctx) => {
    const final = join(dest, `${ctx.name}.csv.gz`), tmp = final + ".partial";
    const w = createWriteStream(tmp), h = createHash("sha256");
    let bytes = 0, rows = 0, rawBytes = Buffer.byteLength(HEADER_LINE);
    const put = async (b) => { h.update(b); bytes += b.length; if (!w.write(b)) await once(w, "drain"); };
    await put(header);
    for (let i = 0; i < plan.length; i++) {
      const m = records[i].contexts[ctx.name];
      const f = join(work, "chunks", ctx.name, `${chunkName(plan[i].index)}.csv.gz`);
      const src = createHash("sha256");
      for await (const b of createReadStream(f)) { src.update(b); await put(b); }
      if (src.digest("hex") !== m.gzSha256) throw new Error(`EXPORT_CHUNK_CORRUPT ${ctx.name} chunk ${plan[i].index}`);
      rows += m.rows; rawBytes += m.rawBytes;
    }
    w.end(); await once(w, "close");
    const fd = openSync(tmp, "r+"); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, final);
    files[ctx.name] = { path: `${ctx.name}.csv.gz`, rows, bytes, sha256: h.digest("hex"), rawBytes };
  };
  const pending = [...CONTEXTS];
  await Promise.all(Array.from({ length: 4 }, async () => { while (pending.length) await one(pending.shift()); }));
  return Object.fromEntries(CONTEXTS.map((c) => [c.name, files[c.name]]));
}
export const defaultJobs = () => Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2)));
