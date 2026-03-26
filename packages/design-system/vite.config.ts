import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: "exports-only",
      input: {
        index: resolve(packageDir, "src/index.ts"),
        styles: resolve(packageDir, "src/styles.ts"),
        "theme-runtime": resolve(packageDir, "src/themeRuntime.ts"),
        "theme-contract": resolve(packageDir, "src/theme-contract.ts"),
        themes: resolve(packageDir, "src/themes.ts"),
        tokens: resolve(packageDir, "src/tokens.ts"),
        motion: resolve(packageDir, "src/motion.ts"),
        "shell-theme-values": resolve(packageDir, "src/shell-theme-values.ts"),
      },
      output: {
        dir: "dist",
        format: "es",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
