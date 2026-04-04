import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ku0/code-runtime-host-contract": path.resolve(
        configDir,
        "../code-runtime-host-contract/src/index.ts"
      ),
      "@ku0/code-runtime-host-contract/": `${path.resolve(
        configDir,
        "../code-runtime-host-contract/src"
      )}/`,
      "@ku0/code-runtime-webmcp-client": path.resolve(
        configDir,
        "../code-runtime-webmcp-client/src/index.ts"
      ),
      "@ku0/code-runtime-webmcp-client/": `${path.resolve(
        configDir,
        "../code-runtime-webmcp-client/src"
      )}/`,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/vitest.setup.ts"],
  },
});
