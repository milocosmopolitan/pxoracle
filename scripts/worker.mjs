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
    const text = JSON.stringify(payload);
    if (text.length > 1000000) throw new Error("INPUT_TOO_LARGE");
    const ptr = mod._malloc(mod.lengthBytesUTF8(text) + 1);
    if (!ptr) throw new Error("ALLOCATION_FAILED");
    let output = 0;
    try {
      mod.stringToUTF8(text, ptr, mod.lengthBytesUTF8(text) + 1);
      output = mod._px_process(ptr);
      const response = JSON.parse(mod.UTF8ToString(output));
      self.postMessage({ version: 1, id, ...response });
    } finally {
      mod._free(ptr);
      if (output) mod._px_free(output);
    }
  } catch (error) {
    self.postMessage({
      version: 1,
      id,
      ok: false,
      error: {
        code: ["INPUT_TOO_LARGE", "ALLOCATION_FAILED"].includes(error?.message)
          ? error.message
          : "ENGINE_LOAD_FAILED",
      },
    });
  }
};
