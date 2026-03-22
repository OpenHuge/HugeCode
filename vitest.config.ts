import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./vitest.root.config.ts",
      "apps/*/vitest.config.{ts,mts,cts,js,mjs,cjs}",
      "packages/*/vitest.config.{ts,mts,cts,js,mjs,cjs}",
    ],
  },
});
