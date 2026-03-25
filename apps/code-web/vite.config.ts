import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createCodeWorkspaceAliases } from "../../scripts/lib/viteWorkspaceAliases.ts";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as { version: string };

export default defineConfig(({ command }) => {
  const isDevServer = command === "serve";

  return {
    plugins: [
      // Local `vite dev` remains a plain TanStack Start server. The stricter Cloudflare
      // ViteEnvironment API currently conflicts with vanilla-extract in this repo, so we keep
      // the minimal Cloudflare plugin enabled only for build/preview/deploy.
      !isDevServer ? cloudflare() : null,
      tanstackStart({
        srcDirectory: "./app",
        importProtection: {
          enabled: true,
          server: {
            specifiers: [/^@tauri-apps\//],
          },
        },
        router: {
          generatedRouteTree: "./routeTree.gen.ts",
          routesDirectory: "./routes",
        },
      }),
      vanillaExtractPlugin(),
      react(),
    ].filter(Boolean),
    ssr: {
      optimizeDeps: {
        include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
      },
    },
    resolve: {
      alias: createCodeWorkspaceAliases(new URL("./", import.meta.url)),
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      port: 3001,
    },
  };
});
