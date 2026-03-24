import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineProject, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineProject({
    plugins: [vanillaExtractPlugin()],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      setupFiles: ["src/test/vitest.setup.ts"],
    },
  })
);
