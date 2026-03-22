import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineProject, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";
import { aliases } from "../../vitest.aliases";

export default mergeConfig(
  sharedConfig,
  defineProject({
    plugins: [vanillaExtractPlugin()],
    resolve: {
      alias: aliases,
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  })
);
