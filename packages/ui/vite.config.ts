import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import preserveDirectives from "rollup-preserve-directives";
import { defineConfig } from "vite";

const designSystemStylesEntry = fileURLToPath(
  new URL("../design-system/src/styles.ts", import.meta.url)
);
const designSystemEntry = fileURLToPath(new URL("../design-system/src/index.ts", import.meta.url));
const sharedEntry = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));

function isExternal(id: string) {
  if (
    id === "@ku0/design-system" ||
    id.startsWith("@ku0/design-system/") ||
    id === "@ku0/shared" ||
    id.startsWith("@ku0/shared/") ||
    id === "clsx"
  ) {
    return false;
  }
  return !id.startsWith(".") && !id.startsWith("/") && !id.includes(":");
}

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: [
      {
        find: "@ku0/design-system/styles",
        replacement: designSystemStylesEntry,
      },
      {
        find: "@ku0/design-system",
        replacement: designSystemEntry,
      },
      {
        find: "@ku0/shared",
        replacement: sharedEntry,
      },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      plugins: [preserveDirectives()],
      preserveEntrySignatures: "exports-only",
      input: {
        index: resolve(__dirname, "src/index.ts"),
        "styles/globals": resolve(__dirname, "src/styles/globals.ts"),
        "styles/tokens": resolve(__dirname, "src/styles/tokens.ts"),
      },
      external: isExternal,
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
