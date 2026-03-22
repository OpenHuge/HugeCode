import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "./vitest.shared";

const rootExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.next/**",
  "**/.out/**",
];

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["tests/scripts/**/*.test.ts", "tests/scripts/**/*.test.tsx"],
      exclude: rootExclude,
    },
  })
);
