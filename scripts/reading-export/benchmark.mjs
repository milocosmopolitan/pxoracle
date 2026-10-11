// Fixed-range benchmark: throughput, peak RSS (sampled with ps), raw/gzip size, temp disk, and extrapolation.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { rmSync, writeFileSync } from "node:fs";
import { CONTEXTS, caseCount } from "./common.mjs";
import { assemble, runChunks } from "./exporter.mjs";

function sampleRss() {
  const rows = execFileSync("ps", ["-axo", "rss=,command="], { encoding: "utf8" }).split("\n");
  let workers = 0, rust = 0, nw = 0;
  for (const r of rows) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(r);
    if (!m) continue;
    if (m[2].includes("chunk-worker.mjs")) { workers += +m[1]; nw++; }
    else if (m[2].includes("reading-export batch")) rust += +m[1];
  }
  return { workers, rust, nw };
}
export async function benchmark({ out, start, end, deckSize, chunkSize, jobs, packs, source, log }) {
  const dir = join(out, "bench");
  rmSync(dir, { recursive: true, force: true });
  let peakTotal = 0, peakWorker = 0, peakRust = 0;
  const timer = setInterval(() => {
    const s = sampleRss();
    peakTotal = Math.max(peakTotal, s.workers + s.rust);
    if (s.nw) peakWorker = Math.max(peakWorker, s.workers / s.nw);
    peakRust = Math.max(peakRust, s.rust);
  }, 400);
  const t0 = Date.now();
  const run = await runChunks({ out: dir, start, end, deckSize, chunkSize, jobs, packs, source, resetWork: true, log, allowLowDisk: true });
  const tRender = (Date.now() - t0) / 1000;
  const tempBytes = execFileSync("du", ["-sk", run.work], { encoding: "utf8" }).split("\t")[0] * 1024;
  const t1 = Date.now();
  const files = await assemble({ out: dir, work: run.work, plan: run.plan, records: run.records });
  const tAssemble = (Date.now() - t1) / 1000;
  clearInterval(timer);
  const cases = end - start;
  const gz = Object.values(files).reduce((a, f) => a + f.bytes, 0), raw = Object.values(files).reduce((a, f) => a + f.rawBytes, 0);
  const full = caseCount(deckSize);
  const perCase = { casesPerSecond: cases / tRender, gzBytesPerCase: gz / cases, rawBytesPerCase: raw / cases };
  const est = {
    renderSeconds: full / perCase.casesPerSecond, assembledGzBytes: perCase.gzBytesPerCase * full, rawBytesUncompressed: perCase.rawBytesPerCase * full,
    peakDiskBytesWithChunksAndAssembled: perCase.gzBytesPerCase * full * 2,
    note: "extrapolation assumes the sampled range is representative of text length and compressibility and that machine load stays comparable",
  };
  const result = { range: [start, end], cases, deckSize, jobs, chunkSize, host: { cpus: (await import("node:os")).cpus().length }, renderSeconds: tRender, assembleSeconds: tAssemble, ...perCase, rawBytes: raw, gzBytes: gz, tempChunkBytes: tempBytes, peakRssBytes: { total: peakTotal * 1024, workerAvg: peakWorker * 1024, rustTotal: peakRust * 1024 }, estimatedFull: est, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { rows: v.rows, bytes: v.bytes, rawBytes: v.rawBytes }])) };
  writeFileSync(join(out, `benchmark-${start}-${end}-j${jobs}.json`), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  rmSync(dir, { recursive: true, force: true });
}
