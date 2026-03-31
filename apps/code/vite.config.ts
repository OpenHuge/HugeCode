import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
// @boundaries-ignore shared workspace test/dev config
// @ts-expect-error NodeNext requires the emitted extension for this shared config import.
import { createCodeWorkspaceAliases } from "../../scripts/lib/viteWorkspaceAliases.ts";

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
const WORKSPACE_HOST_CHUNK_PATTERNS = [
  "/src/features/app/components/MainAppShell.tsx",
  "/src/features/app/components/WorkspaceDesktopAppHost.tsx",
  "/src/features/app/composition/useDesktopWorkspaceFeatureComposition.tsx",
] as const;
const WORKSPACE_CHROME_DOMAIN_CHUNK_PATTERNS = [
  "/src/features/app/composition/useDesktopWorkspaceChromeDomain.ts",
] as const;
const WORKSPACE_CONVERSATION_DOMAIN_CHUNK_PATTERNS = [
  "/src/features/app/composition/useDesktopWorkspaceConversationDomain.ts",
] as const;
const WORKSPACE_MISSION_DOMAIN_CHUNK_PATTERNS = [
  "/src/features/app/composition/useDesktopWorkspaceMissionDomain.ts",
] as const;
const WORKSPACE_PROJECT_DOMAIN_CHUNK_PATTERNS = [
  "/src/features/app/composition/useDesktopWorkspaceProjectDomain.ts",
] as const;
const WORKSPACE_THREAD_DOMAIN_CHUNK_PATTERNS = [
  "/src/features/app/composition/useDesktopWorkspaceThreadDomain.ts",
] as const;
const RUNTIME_GOVERNED_CONTEXT_CHUNK_PATTERNS = [
  "/src/application/runtime/facades/runtimeContextTruth.ts",
  "/src/application/runtime/facades/runtimeMissionControlProvenance.ts",
  "/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts",
  "/src/application/runtime/facades/runtimeReviewContinuationFacade.ts",
  "/src/application/runtime/facades/runtimeReviewIntelligenceSummary.ts",
  "/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts",
] as const;
const RUNTIME_MISSION_CONTROL_CHUNK_PATTERNS = [
  "/src/application/runtime/facades/runtimeBrowserExtractionOperator.ts",
  "/src/application/runtime/facades/runtimeContinuityReadiness.ts",
  "/src/application/runtime/facades/runtimeExecutionReliability.ts",
  "/src/application/runtime/facades/runtimeKernelPluginReadiness.ts",
  "/src/application/runtime/facades/runtimeLaunchReadiness.ts",
  "/src/application/runtime/facades/runtimeMissionControl",
  "/src/application/runtime/facades/runtimeMissionLaunchPreparation.ts",
  "/src/application/runtime/facades/runtimeRepositoryExecutionContract.ts",
  "/src/application/runtime/facades/runtimeParallelDispatchManager.ts",
  "/src/application/runtime/facades/runtimeTaskInterventionDraftFacade.ts",
  "/src/application/runtime/facades/runtimeWorkspaceLaunchDefaultsFacade.ts",
  "/src/application/runtime/facades/runtimeWorkspaceMissionControlProjection.ts",
  "/src/application/runtime/ports/runtimeDiagnostics.ts",
] as const;
const RUNTIME_BROWSER_ASSESSMENT_CHUNK_PATTERNS = [
  "/src/application/runtime/facades/runtimeBrowserAssessment",
  "/src/application/runtime/facades/runtimeBrowserExtractionOperator.ts",
  "/src/application/runtime/facades/runtimeBrowserReadiness.ts",
  "/src/application/runtime/facades/runtimeDiscoveryControl.ts",
  "/src/application/runtime/facades/runtimeAgentControlFacade.ts",
  "/src/application/runtime/hooks/useWorkspaceRuntimeAgentControl.ts",
  "/src/application/runtime/kernel/createRuntimeAgentControlDependencies.ts",
  "/src/application/runtime/ports/browserCapability.ts",
  "/src/application/runtime/ports/runtimeDiscoveryControl.ts",
] as const;
const RUNTIME_APPLICATION_CHUNK_PATTERNS = ["/src/application/runtime/"] as const;
const DESKTOP_SERVICES_CHUNK_PATTERNS = ["/src/services/"] as const;
const DESKTOP_INTEGRATION_CHUNK_PATTERNS = [
  "/src/application/runtime/facades/desktopHostFacade.ts",
  "/src/features/app/hooks/useDesktopLaunchIntentBootstrap.ts",
  "/src/features/about/components/AboutView.tsx",
  "/src/features/update/components/UpdateToast.tsx",
  "/src/features/update/hooks/useUpdater.ts",
] as const;
const SHELL_BOOTSTRAP_CHUNK_PATTERNS = [
  "/src/features/app/hooks/useMainAppShellBootstrap.ts",
] as const;
const THREAD_CODEX_CONTROLS_CHUNK_PATTERNS = [
  "/src/features/app/hooks/useThreadCodexControls.ts",
] as const;
const APP_BOOTSTRAP_CHUNK_PATTERNS = [
  "/src/features/app/hooks/useGitRootSelection.ts",
  "/src/features/app/hooks/useSyncSelectedDiffPath.ts",
] as const;
const SHIKI_LAZY_CHUNK_WARNING_LIMIT_KB = 900;

function shouldDeferNonCriticalJsPreload(file: string) {
  return NON_CRITICAL_JS_PRELOAD_PATTERNS.some((pattern) => pattern.test(file));
}

function matchesChunkPattern(id: string, patterns: readonly string[]) {
  return patterns.some((pattern) => id.includes(pattern));
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
    alias: [...createCodeWorkspaceAliases(new URL("./", import.meta.url))],
  },
  optimizeDeps: {
    // Keep linked workspace packages on the source pipeline. Vite already treats
    // monorepo deps outside node_modules as source, and forcing them through
    // optimizeDeps can break transform-based tooling like vanilla-extract.
    include: [...STARTUP_OPTIMIZE_DEPS],
  },
  build: {
    // Shiki-backed diff rendering emits very large lazy language and WASM chunks
    // from @pierre/diffs. We keep warning visibility for real eager regressions by
    // splitting the app shell more aggressively below, then raise the threshold to
    // cover the known lazy-only payloads.
    chunkSizeWarningLimit: SHIKI_LAZY_CHUNK_WARNING_LIMIT_KB,
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
          if (matchesChunkPattern(id, WORKSPACE_HOST_CHUNK_PATTERNS)) {
            return "workspace-host";
          }
          if (matchesChunkPattern(id, WORKSPACE_CHROME_DOMAIN_CHUNK_PATTERNS)) {
            return "workspace-chrome";
          }
          if (matchesChunkPattern(id, WORKSPACE_CONVERSATION_DOMAIN_CHUNK_PATTERNS)) {
            return "workspace-conversation";
          }
          if (matchesChunkPattern(id, WORKSPACE_MISSION_DOMAIN_CHUNK_PATTERNS)) {
            return "workspace-mission";
          }
          if (matchesChunkPattern(id, WORKSPACE_PROJECT_DOMAIN_CHUNK_PATTERNS)) {
            return "workspace-project";
          }
          if (matchesChunkPattern(id, WORKSPACE_THREAD_DOMAIN_CHUNK_PATTERNS)) {
            return "workspace-thread";
          }
          if (matchesChunkPattern(id, RUNTIME_GOVERNED_CONTEXT_CHUNK_PATTERNS)) {
            return "runtime-governed-context";
          }
          if (matchesChunkPattern(id, RUNTIME_MISSION_CONTROL_CHUNK_PATTERNS)) {
            return "runtime-mission-control";
          }
          if (matchesChunkPattern(id, RUNTIME_BROWSER_ASSESSMENT_CHUNK_PATTERNS)) {
            return "runtime-browser-assessment";
          }
          if (matchesChunkPattern(id, RUNTIME_APPLICATION_CHUNK_PATTERNS)) {
            return "runtime-application";
          }
          if (matchesChunkPattern(id, DESKTOP_SERVICES_CHUNK_PATTERNS)) {
            return "desktop-services";
          }
          if (matchesChunkPattern(id, DESKTOP_INTEGRATION_CHUNK_PATTERNS)) {
            return "desktop-integration";
          }
          if (matchesChunkPattern(id, SHELL_BOOTSTRAP_CHUNK_PATTERNS)) {
            return "shell-bootstrap";
          }
          if (matchesChunkPattern(id, THREAD_CODEX_CONTROLS_CHUNK_PATTERNS)) {
            return "thread-codex-controls";
          }
          if (matchesChunkPattern(id, APP_BOOTSTRAP_CHUNK_PATTERNS)) {
            return "app-bootstrap";
          }
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/@tanstack/")) {
            return "tanstack-vendor";
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
