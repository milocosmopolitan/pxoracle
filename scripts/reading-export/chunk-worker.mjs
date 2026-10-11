// Renders one contiguous case chunk into 12 independent gzip members (one per context).
// Usage (spawned by the orchestrator): node --import tsx chunk-worker.mjs <job.json>
// Output files only become visible under their final names after the sidecar record is written last.
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { createWriteStream, openSync, fsyncSync, closeSync, renameSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTEXTS, GZIP_LEVEL, csvLine, decodeCase, deckIds, loadPacks, rowFromPlan, reading,
} from "./common.mjs";

export const chunkName = (index) => String(index).padStart(6, "0");

/** A gzip member writer that hashes both the raw CSV and the compressed bytes. */
function memberWriter(path) {
  const gz = createGzip({ level: GZIP_LEVEL }); // Node writes mtime 0 and no file name: reproducible members
  const file = createWriteStream(path, { flags: "w" });
  const raw = createHash("sha256"), packed = createHash("sha256");
  let rawBytes = 0, gzBytes = 0, error = null;
  gz.on("data", (b) => { packed.update(b); gzBytes += b.length; });
  gz.on("error", (e) => (error = e));
  file.on("error", (e) => (error = e));
  gz.pipe(file);
  return {
    async write(text) {
      if (error) throw error;
      const b = Buffer.from(text, "utf8");
      raw.update(b);
      rawBytes += b.length;
      if (!gz.write(b)) await once(gz, "drain");
    },
    async close() {
      gz.end();
      await once(file, "close");
      if (error) throw error;
      const fd = openSync(path, "r+");
      try { fsyncSync(fd); } finally { closeSync(fd); }
      return { rawBytes, rawSha256: raw.digest("hex"), gzBytes, gzSha256: packed.digest("hex") };
    },
    abort() { gz.destroy(); file.destroy(); },
  };
}
export async function renderChunk(job) {
  const { dir, index, from, to, deckSize, binary, stopFile } = job;
  const P = loadPacks();
  const ids = deckIds(deckSize);
  const name = chunkName(index);
  const parts = CONTEXTS.map((c) => {
    const d = join(dir, "chunks", c.name);
    mkdirSync(d, { recursive: true });
    return { dir: d, tmp: join(d, `${name}.csv.gz.partial`), final: join(d, `${name}.csv.gz`) };
  });
  const writers = parts.map((p) => memberWriter(p.tmp));
  const args = ["batch", "--semantics", P.paths.semantics, "--rules", P.paths.rules, "--start", String(from), "--end", String(to), "--deck-size", String(deckSize)];
  if (stopFile) args.push("--stop-file", stopFile);
  const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b));
  const exited = new Promise((res) => child.on("close", (code, sig) => res({ code, sig })));
  let expected = from, pending = "";
  try {
    const handle = async (line) => {
      const o = JSON.parse(line);
      if (o.case !== expected || o.plans.length !== CONTEXTS.length) throw new Error(`EXPORT_ORDER expected case ${expected} got ${o.case}`);
      const cards = decodeCase(expected, deckSize);
      for (let k = 0; k < CONTEXTS.length; k++) {
        const plan = o.plans[k];
        if (plan.context.topic !== CONTEXTS[k].topic || plan.context.intent !== CONTEXTS[k].intent) throw new Error(`EXPORT_ORDER context ${expected}/${k}`);
        plan.cards.forEach((c, i) => {
          if (c.cardId !== ids[cards[i][0]] || (c.orientation === "reversed") !== cards[i][1]) throw new Error(`EXPORT_ENUMERATION case ${expected}`);
        });
        await writers[k].write(csvLine(rowFromPlan(expected, plan, P.prose)));
      }
      expected++;
    };
    for await (const chunk of child.stdout.setEncoding("utf8")) {
      pending += chunk;
      let nl;
      let start = 0;
      while ((nl = pending.indexOf("\n", start)) >= 0) {
        await handle(pending.slice(start, nl));
        start = nl + 1;
      }
      pending = pending.slice(start);
    }
    const { code, sig } = await exited;
    if (code !== 0 || pending || expected !== to) throw new Error(`EXPORT_RUNNER code=${code} signal=${sig} produced=${expected - from}/${to - from} ${stderr.trim()}`);
    const contexts = {};
    for (let k = 0; k < CONTEXTS.length; k++) {
      const m = await writers[k].close();
      renameSync(parts[k].tmp, parts[k].final);
      contexts[CONTEXTS[k].name] = { rows: to - from, ...m };
    }
    // The sidecar is written last and atomically: its presence is the only completeness signal.
    const record = { index, from, to, contexts };
    writeFileSync(join(dir, "chunks", `${name}.json.tmp`), JSON.stringify(record));
    renameSync(join(dir, "chunks", `${name}.json.tmp`), join(dir, "chunks", `${name}.json`));
    return record;
  } catch (e) {
    child.kill("SIGKILL");
    writers.forEach((w) => w.abort());
    for (const p of parts) rmSync(p.tmp, { force: true });
    throw e;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const job = JSON.parse(process.argv[2]);
  // An orphaned worker (parent killed) must not keep writing while a resumed run owns the chunk.
  setInterval(() => { if (process.ppid !== job.parentPid) process.exit(1); }, 500).unref();
  renderChunk(job).then(
    (r) => { process.stdout.write(JSON.stringify({ ok: true, index: r.index }) + "\n"); },
    (e) => { process.stderr.write(String((e && e.message) || e) + "\n"); process.exit(1); },
  );
}
