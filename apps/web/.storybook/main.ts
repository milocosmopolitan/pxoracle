import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  viteFinal: async (config) => {
    // Vite's bundled watcher selects native FSEvents before reading this env flag.
    // Pass the option before construction so CI/worktree polling actually takes effect.
    if (process.env.CHOKIDAR_USEPOLLING === "true") {
      config.server ??= {};
      config.server.watch = {
        ...config.server.watch,
        usePolling: true,
        interval: Number(process.env.CHOKIDAR_INTERVAL) || 100,
      };
    }
    // Storybook staticDirs owns copying/serving assets; avoid Vite copying them concurrently.
    config.publicDir = false;
    config.define = { "process.env": "{}", ...config.define };
    config.optimizeDeps ??= {};
    config.optimizeDeps.esbuildOptions ??= {};
    config.optimizeDeps.esbuildOptions.define = {"process.env":"{}",...config.optimizeDeps.esbuildOptions.define};
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@pxoracle/contracts/globe-geography": fileURLToPath(new URL("../../../packages/contracts/src/globe-geography.ts", import.meta.url)),
      "@pxoracle/contracts/globe-view": fileURLToPath(new URL("../../../packages/contracts/src/globe-view.ts", import.meta.url)),
      "@pxoracle/contracts/atlas": fileURLToPath(new URL("../../../packages/contracts/src/atlas.ts", import.meta.url)),
      "@pxoracle/contracts": fileURLToPath(
        new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@pxoracle/scene-runtime": fileURLToPath(
        new URL(
          "../../../packages/scene-runtime/src/index.ts",
          import.meta.url,
        ),
      ),
      "@pxoracle/scenes": fileURLToPath(
        new URL("../../../packages/scenes/src", import.meta.url),
      ),
      "@pxoracle/engine-client": fileURLToPath(
        new URL("../../../packages/engine-client/src", import.meta.url),
      ),
    };
    return config;
  },
};
export default config;
