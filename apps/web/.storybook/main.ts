import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  viteFinal: async (config) => {
    // Storybook staticDirs owns copying/serving assets; avoid Vite copying them concurrently.
    config.publicDir = false;
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
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
