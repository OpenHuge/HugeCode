import { resolve } from "node:path";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

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
        index: resolve(__dirname, "src/index.ts"),
        styles: resolve(__dirname, "src/styles.ts"),
        "theme-runtime": resolve(__dirname, "src/themeRuntime.ts"),
        "theme-contract": resolve(__dirname, "src/theme-contract.ts"),
        themes: resolve(__dirname, "src/themes.ts"),
        tokens: resolve(__dirname, "src/tokens.ts"),
        motion: resolve(__dirname, "src/motion.ts"),
        "shell-theme-values": resolve(__dirname, "src/shell-theme-values.ts"),
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
