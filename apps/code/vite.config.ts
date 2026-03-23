import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
// @boundaries-ignore shared workspace test/dev config
import { createCodeWorkspaceAliases } from "../../scripts/lib/viteWorkspaceAliases";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as { version: string };

const DEFAULT_DEV_HOST = "::";
const STARTUP_OPTIMIZE_DEPS = [
  "lucide-react",
  "lucide-react/dist/esm/icons/*",
  "react",
  "react-dom",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "react-markdown",
  "remark-gfm",
  "vscode-material-icons",
] as const;
const STARTUP_WARMUP_CLIENT_FILES = [
  "./src/main.tsx",
  "./src/App.tsx",
  "./src/web/WorkspaceClientEntry.tsx",
  "./src/features/app/components/AppModals.tsx",
  "./src/features/composer/components/ComposerInput.tsx",
  "./src/features/files/components/FileTreePanel.tsx",
  "./src/features/settings/components/settingsViewLoader.ts",
  "./src/features/settings/components/SettingsView.tsx",
  "./src/features/settings/components/SettingsViewCore.tsx",
  "./src/features/shared/components/FileTypeIconImage.tsx",
] as const;
const NON_CRITICAL_JS_PRELOAD_PATTERNS = [
  /^assets\/sentry-[^/]+\.js$/,
  /^assets\/settings(?:ViewLoader)?-[^/]+\.js$/,
  /^assets\/xterm-vendor-[^/]+\.(?:js|css)$/,
] as const;

function shouldDeferNonCriticalJsPreload(file: string) {
  return NON_CRITICAL_JS_PRELOAD_PATTERNS.some((pattern) => pattern.test(file));
}

function resolveDevHost() {
  const envHost =
    process.env.WEB_E2E_HOST?.trim() ||
    process.env.CODE_RUNTIME_WEB_HOST?.trim() ||
    DEFAULT_DEV_HOST;
  return envHost.length > 0 ? envHost : DEFAULT_DEV_HOST;
}

function workspaceEntryRedirectMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== "GET" || !req.url) {
      next();
      return;
    }
    const requestUrl = new URL(req.url, "http://workspace-shell.invalid");
    if (requestUrl.pathname !== "/") {
      next();
      return;
    }
    const location = `/workspaces${requestUrl.search}`;
    res.statusCode = 302;
    res.setHeader("Location", location);
    res.end();
  };
}

function workspaceEntryRedirectPlugin(): Plugin {
  return {
    name: "workspace-entry-redirect",
    configureServer(server) {
      server.middlewares.use(workspaceEntryRedirectMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(workspaceEntryRedirectMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [workspaceEntryRedirectPlugin(), vanillaExtractPlugin(), react()],
  resolve: {
    alias: createCodeWorkspaceAliases(new URL("./", import.meta.url)),
  },
  optimizeDeps: {
    // Keep linked workspace packages on the source pipeline. Vite already treats
    // monorepo deps outside node_modules as source, and forcing them through
    // optimizeDeps can break transform-based tooling like vanilla-extract.
    include: [...STARTUP_OPTIMIZE_DEPS],
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType === "js") {
          return deps.filter((dep) => !shouldDeferNonCriticalJsPreload(dep));
        }
        return deps;
      },
    },
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        fixtures: fileURLToPath(new URL("./fixtures.html", import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/@tanstack/")) {
            return "tanstack-vendor";
          }
          if (id.includes("/node_modules/@tauri-apps/")) {
            return "tauri-vendor";
          }
          if (id.includes("/node_modules/@xterm/")) {
            return "xterm-vendor";
          }
          if (id.includes("/node_modules/prismjs/")) {
            return "prism-vendor";
          }
          if (id.includes("/node_modules/@sentry/")) {
            const sentryPackageMatch = id.match(/\/node_modules\/@sentry\/([^/]+)\//);
            const sentryPackageName = sentryPackageMatch?.[1] ?? "shared";
            return `sentry-${sentryPackageName}`;
          }
          return undefined;
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    host: resolveDevHost(),
    port: 5187,
    warmup: {
      clientFiles: [...STARTUP_WARMUP_CLIENT_FILES],
    },
  },
});
