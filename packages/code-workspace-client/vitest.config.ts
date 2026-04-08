import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineProject, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";
import { aliases } from "../../vitest.aliases";

const workspaceClientAliases = [
  {
    find: /^@ku0\/code-platform-interfaces\/(.+)$/,
    replacement: new URL("../code-platform-interfaces/src/$1", import.meta.url).pathname,
  },
  {
    find: /^@ku0\/code-platform-interfaces$/,
    replacement: new URL("../code-platform-interfaces/src/index.ts", import.meta.url).pathname,
  },
  ...aliases,
];

export default mergeConfig(
  sharedConfig,
  defineProject({
    plugins: [vanillaExtractPlugin()],
    resolve: {
      alias: workspaceClientAliases,
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  })
);
