let initialized;
async function engine() {
  if (!initialized)
    initialized = import("./engine.mjs")
      .then(({ default: create }) => create())
      .catch(() => {
        initialized = undefined;
        throw new Error("ENGINE_LOAD_FAILED");
      });
  return initialized;
}
function dispatch(mod, payload) {
  const text = JSON.stringify(payload);
  if (text.length > 1000000) throw new Error("INPUT_TOO_LARGE");
  const size = mod.lengthBytesUTF8(text) + 1;
  const ptr = mod._malloc(size);
  if (!ptr) throw new Error("ALLOCATION_FAILED");
  let output = 0;
  try {
    mod.stringToUTF8(text, ptr, size);
    output = mod._px_process(ptr);
    return JSON.parse(mod.UTF8ToString(output));
  } finally {
    mod._free(ptr);
    if (output) mod._px_free(output);
  }
}
let readingReady;
async function prepareReading(mod, versions) {
  const expected = {
    schema: 1,
    engine: "reading.1",
    semantics: "semantics.1",
    rules: "rules.1",
    content: "reading.en.1",
  };
  if (
    !versions ||
    Object.keys(versions).length !== 5 ||
    Object.entries(expected).some(([key, value]) => versions[key] !== value)
  )
    throw new Error("READING_VERSION");
  if (!readingReady)
    readingReady = Promise.all(
      ["semantics.1", "rules.1"].map(async (name) => {
        const response = await fetch(`/content/reading/${name}.json`);
        if (!response.ok) throw new Error("READING_PACK_FAILED");
        const text = await response.text();
        if (text.length > 750000) throw new Error("READING_PACK_FAILED");
        return JSON.parse(text);
      }),
    )
      .then(([semantics, rules]) => {
        const result = dispatch(mod, {
          op: "readingInitialize",
          semantics,
          rules,
        });
        if (!result.ok) throw new Error(result.error.code);
      })
      .catch((error) => {
        readingReady = undefined;
        throw error;
      });
  await readingReady;
}
let natalReady;
async function prepareNatal(mod, versions) {
  const expected = {
    schema: 1,
    calculation: "0.1.0",
    interpretation: "natal.1",
    semantics: "natal-semantics.1",
    rules: "natal-rules.1",
    content: "natal.en.1",
  };
  if (
    !versions ||
    Object.keys(versions).length !== 6 ||
    Object.entries(expected).some(([key, value]) => versions[key] !== value)
  )
    throw new Error("NATAL_VERSION");
  if (!natalReady)
    natalReady = (async () => {
      const response = await fetch("/content/natal/manifest.1.json");
      if (!response.ok) throw new Error("NATAL_PACK_FAILED");
      const manifestText = await response.text();
      if (manifestText.length > 10000) throw new Error("NATAL_PACK_FAILED");
      const manifest = JSON.parse(manifestText);
      if (
        Object.keys(manifest.versions ?? {}).length !== 6 ||
        Object.entries(expected).some(
          ([key, value]) => manifest.versions[key] !== value,
        )
      )
        throw new Error("NATAL_VERSION");
      const [semantics, rules] = await Promise.all(
        ["semantics", "rules"].map(async (name) => {
          const file = manifest.files?.[name];
          if (
            file?.path !== `${name}.1.json` ||
            !Number.isInteger(file.bytes) ||
            file.bytes < 1 ||
            file.bytes > 300000 ||
            !/^[a-f0-9]{64}$/.test(file.sha256)
          )
            throw new Error("NATAL_PACK_FAILED");
          const res = await fetch(`/content/natal/${file.path}`);
          if (!res.ok || Number(res.headers.get("content-length")) > 300000)
            throw new Error("NATAL_PACK_FAILED");
          const bytes = await res.arrayBuffer();
          if (bytes.byteLength !== file.bytes)
            throw new Error("NATAL_PACK_FAILED");
          const digest = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (x) => x.toString(16).padStart(2, "0"),
          ).join("");
          if (digest !== file.sha256) throw new Error("NATAL_PACK_FAILED");
          return JSON.parse(new TextDecoder().decode(bytes));
        }),
      );
      const result = dispatch(mod, { op: "natalInitialize", semantics, rules });
      if (!result.ok) throw new Error(result.error.code);
    })().catch((error) => {
      natalReady = undefined;
      throw error;
    });
  await natalReady;
}
self.onmessage = async ({ data }) => {
  const { version, id, payload } = data ?? {};
  if (version !== 1 || !Number.isSafeInteger(id)) {
    self.postMessage({
      version: 1,
      id: Number.isSafeInteger(id) ? id : 0,
      ok: false,
      error: { code: "PROTOCOL_VERSION" },
    });
    return;
  }
  try {
    const mod = await engine();
    if (payload?.op === "readingInterpret")
      await prepareReading(mod, payload.input?.versions);
    if (payload?.op === "natalInterpret")
      await prepareNatal(mod, payload.input?.versions);
    self.postMessage({ version: 1, id, ...dispatch(mod, payload) });
  } catch (error) {
    const allowed = [
      "INPUT_TOO_LARGE",
      "ALLOCATION_FAILED",
      "READING_VERSION",
      "READING_PACK",
      "READING_PACK_FAILED",
      "NATAL_VERSION",
      "NATAL_PACK_FAILED",
      "NATAL_PACK_INVALID",
    ];
    self.postMessage({
      version: 1,
      id,
      ok: false,
      error: {
        code: allowed.includes(error?.message)
          ? error.message
          : payload?.op === "natalInterpret"
            ? "NATAL_PACK_FAILED"
            : payload?.op === "readingInterpret"
              ? "READING_PACK_FAILED"
              : "ENGINE_LOAD_FAILED",
      },
    });
  }
};
