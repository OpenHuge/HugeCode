import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { aliases } from "./vitest.aliases";
import sharedConfig from "./vitest.shared";

const configDir = path.dirname(fileURLToPath(import.meta.url));

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
    resolve: {
      alias: [
        {
          find: /^@ku0\/code-runtime-host-contract\/(.+)$/,
          replacement: path.resolve(configDir, "packages/code-runtime-host-contract/src/$1"),
        },
        {
          find: /^@ku0\/code-runtime-host-contract$/,
          replacement: path.resolve(configDir, "packages/code-runtime-host-contract/src/index.ts"),
        },
        {
          find: /^@ku0\/code-runtime-webmcp-client\/(.+)$/,
          replacement: path.resolve(configDir, "packages/code-runtime-webmcp-client/src/$1"),
        },
        {
          find: /^@ku0\/code-runtime-webmcp-client$/,
          replacement: path.resolve(configDir, "packages/code-runtime-webmcp-client/src/index.ts"),
        },
        ...aliases,
      ],
    },
    test: {
      environment: "node",
      include: ["tests/scripts/**/*.test.ts", "tests/scripts/**/*.test.tsx"],
      exclude: rootExclude,
    },
  })
);
