import fs from "node:fs";
import path from "node:path";

export const UI_ROOTS = [
  "apps/code/src/design-system/",
  "apps/code/src/features/",
  "apps/code/src/hooks/",
  "apps/code/src/components/",
  "apps/code/src/web/",
  "apps/code-web/app/",
  "packages/code-workspace-client/src/",
];
export const APP_SOURCE_ROOT = "apps/code/src/";
export const RUNTIME_ARCHITECTURE_ROOT = "apps/code/src/application/runtime/";
export const APP_PRODUCT_EXCLUDED_PREFIXES = [
  "apps/code/src/application/runtime/",
  "apps/code/src/services/",
];

export const UI_ENTRY_FILES = new Set([
  "apps/code/src/web/WorkspaceAppBridge.tsx",
  "apps/code/src/MainAppCore.tsx",
  "apps/code/src/MainAppContainer.tsx",
  "apps/code/src/MainAppContainerCore.tsx",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const RUNTIME_ARCHITECTURE_SERVICE_IMPORT_EXCEPTIONS = new Set([
  "apps/code/src/application/runtime/facades/runtimeWebMcpBridgeFacade.ts",
  "apps/code/src/application/runtime/ports/webMcpBridgeCompat.ts",
  "apps/code/src/application/runtime/ports/tauriOauth.ts",
  "apps/code/src/application/runtime/runtimeClient.ts",
  "apps/code/src/application/runtime/runtimeClientMode.ts",
  "apps/code/src/application/runtime/runtimeEventChannelDiagnostics.ts",
  "apps/code/src/application/runtime/runtimeEventStabilityMetrics.ts",
  "apps/code/src/application/runtime/runtimeEventStateMachine.ts",
  "apps/code/src/application/runtime/types/webMcpBridge.ts",
  "apps/code/src/application/runtime/webMcpBridge.ts",
  "apps/code/src/application/runtime/ports/runtimeClientCapabilitiesContract.ts",
]);

const TAURI_IMPORT_PATTERN =
  /(?:from\s+["']@tauri-apps\/(?:api|plugin)(?:\/[^"']*)?["']|import\(\s*["']@tauri-apps\/(?:api|plugin)(?:\/[^"']*)?["']\s*\))/u;
const FEATURE_COMPONENT_HOOK_PREFIX = /^apps\/code\/src\/(?:features|components|hooks)\//;
const SETTINGS_ACCOUNT_MIGRATION_FILES = new Set([
  "apps/code/src/features/settings/hooks/useAppSettings.ts",
  "apps/code/src/features/settings/hooks/useSettingsDefaultModels.ts",
  "apps/code/src/features/app/hooks/useAccountCenterState.ts",
]);

export function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

export function isUiTestFile(filePath) {
  return /(?:^|\/)(?:__tests__\/)?[^/]+\.(?:test|spec)(?:\.[^/]+)?\.[cm]?[jt]sx?$/u.test(filePath);
}

export function isCandidateFile(filePath) {
  return (
    isUiBoundaryFile(filePath) ||
    isNonUiAppProductFile(filePath) ||
    isRuntimeArchitectureFile(filePath)
  );
}

export function isUiBoundaryFile(filePath) {
  const normalized = toPosixPath(filePath);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(extension)) {
    return false;
  }
  if (UI_ROOTS.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  return UI_ENTRY_FILES.has(normalized);
}

function isFeatureComponentHookFile(filePath) {
  return FEATURE_COMPONENT_HOOK_PREFIX.test(filePath);
}

function isAppSourceFile(filePath) {
  const normalized = toPosixPath(filePath);
  const extension = path.posix.extname(normalized).toLowerCase();
  return SOURCE_EXTENSIONS.has(extension) && normalized.startsWith(APP_SOURCE_ROOT);
}

function isRuntimeArchitectureFile(filePath) {
  const normalized = toPosixPath(filePath);
  return isAppSourceFile(normalized) && normalized.startsWith(RUNTIME_ARCHITECTURE_ROOT);
}

function isNonUiAppProductFile(filePath) {
  const normalized = toPosixPath(filePath);
  if (!isAppSourceFile(normalized) || isUiTestFile(normalized) || isUiBoundaryFile(normalized)) {
    return false;
  }
  return !APP_PRODUCT_EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function listFilesFromEnv(env = process.env) {
  const raw = env.VALIDATE_CHANGED_FILES_JSON;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => toPosixPath(String(entry)));
  } catch {
    return [];
  }
}

function walkDirectory(repoRoot, dirPath) {
  const stack = [dirPath];
  const result = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      result.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }

  return result;
}

export function listAllUiFiles(repoRoot) {
  const files = [];
  for (const rootPath of UI_ROOTS) {
    const absolutePath = path.join(repoRoot, rootPath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    files.push(...walkDirectory(repoRoot, absolutePath));
  }

  for (const filePath of UI_ENTRY_FILES) {
    const absolutePath = path.join(repoRoot, filePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.push(filePath);
    }
  }

  return files;
}

function resolveLineNumberForIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/u).length;
}

function listAllAppSourceFiles(repoRoot) {
  const absolutePath = path.join(repoRoot, APP_SOURCE_ROOT);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  return walkDirectory(repoRoot, absolutePath);
}

const VIOLATION_RULES = [
  {
    id: "service",
    description: "no direct `src/services/*` import",
    pattern: /(?:from\s+["'][^"']*\/services\/|import\(\s*["'][^"']*\/services\/)/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "runtime-implementation",
    description:
      "only `application/runtime/facades/*`, `application/runtime/kernel/*`, `application/runtime/ports/*`, or `application/runtime/types/*` may be imported from UI code",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/(?!facades(?:\/|["'])|kernel(?:\/|["'])|ports(?:\/|["'])|types(?:\/|["']))|import\(\s*["'][^"']*\/application\/runtime\/(?!facades(?:\/|["'])|kernel(?:\/|["'])|ports(?:\/|["'])|types(?:\/|["'])))/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "cross-shell-tauri-port",
    description:
      "shared workspace client and web shell must not import desktop-only `application/runtime/ports/tauri*` ports",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/tauri[A-Z][^"']*["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/tauri[A-Z][^"']*["'])/u,
    appliesTo: (filePath) =>
      !isUiTestFile(filePath) &&
      (filePath.startsWith("apps/code-web/") ||
        filePath.startsWith("packages/code-workspace-client/")),
  },
  {
    id: "runtime-legacy-bridge",
    description:
      "no direct retired runtime bridge import (`tauriSettings`, `tauriWorkspaces`, `tauriSkills`, `tauriRuntimeSkills`, or raw `tauri`)",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/(?:tauriSettings|tauriWorkspaces|tauriSkills|tauriRuntimeSkills|tauri)["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/(?:tauriSettings|tauriWorkspaces|tauriSkills|tauriRuntimeSkills|tauri)["'])/u,
    appliesTo: (filePath) => isUiBoundaryFile(filePath) && !isUiTestFile(filePath),
  },
  {
    id: "runtime-legacy-bridge-app",
    description:
      "non-UI product code must not import retired runtime bridge ports (`tauriSettings`, `tauriWorkspaces`, `tauriSkills`, `tauriRuntimeSkills`, or raw `tauri`)",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/(?:tauriSettings|tauriWorkspaces|tauriSkills|tauriRuntimeSkills|tauri)["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/(?:tauriSettings|tauriWorkspaces|tauriSkills|tauriRuntimeSkills|tauri)["'])/u,
    appliesTo: isNonUiAppProductFile,
  },
  {
    id: "web-app-server-function",
    description:
      "apps/code-web /app routes must stay thin hosts and must not define TanStack Start server functions",
    pattern: /\bcreateServerFn\b/u,
    appliesTo: (filePath) =>
      !isUiTestFile(filePath) && /^apps\/code-web\/app\/routes\/app(?:\/|[-/])/u.test(filePath),
  },
  {
    id: "runtime-settings-account-legacy-bridge",
    description:
      "migrated account/settings hooks must not import legacy settings or oauth bridge ports directly",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/(?:tauriOauth|tauriModels|tauriRemoteServers|tauriAppSettings|tauriWorkspaceCatalog)["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/(?:tauriOauth|tauriModels|tauriRemoteServers|tauriAppSettings|tauriWorkspaceCatalog)["'])/u,
    appliesTo: (filePath) =>
      !isUiTestFile(filePath) && SETTINGS_ACCOUNT_MIGRATION_FILES.has(filePath),
  },
  {
    id: "runtime-low-level-service-app",
    description:
      "non-UI product code must not import low-level runtime transport/event/webMcp services directly",
    pattern:
      /(?:from\s+["'][^"']*\/services\/(?:runtimeClient|runtimeEvent|webMcp)[^"']*["']|import\(\s*["'][^"']*\/services\/(?:runtimeClient|runtimeEvent|webMcp)[^"']*["']\s*\))/u,
    appliesTo: isNonUiAppProductFile,
  },
  {
    id: "runtime-architecture-low-level-service",
    description:
      "application/runtime must not import low-level runtimeClient/runtimeEvent/webMcp services directly outside explicit compatibility shims",
    pattern:
      /(?:from\s+["'][^"']*\/services\/(?:runtimeClient|runtimeEvent|webMcp)[^"']*["']|import\(\s*["'][^"']*\/services\/(?:runtimeClient|runtimeEvent|webMcp)[^"']*["']\s*\))/u,
    appliesTo: (filePath) =>
      isRuntimeArchitectureFile(filePath) &&
      !isUiTestFile(filePath) &&
      !RUNTIME_ARCHITECTURE_SERVICE_IMPORT_EXCEPTIONS.has(filePath),
  },
  {
    id: "runtime-kernel-client-port",
    description:
      "application/runtime facades and kernel must not import `getRuntimeClient`; use RuntimeKernel or narrower ports instead",
    pattern:
      /(?:import\s*\{\s*[^}]*\bgetRuntimeClient\b[^}]*\}\s*from\s+["'][^"']*(?:ports\/runtimeClient|runtimeClient)["']|import\s*\{\s*[^}]*\bgetRuntimeClient\b[^}]*\}\s*from\s+["']\.\.\/(?:ports\/runtimeClient|runtimeClient)["'])/u,
    appliesTo: (filePath) =>
      !isUiTestFile(filePath) &&
      (filePath.startsWith("apps/code/src/application/runtime/facades/") ||
        filePath.startsWith("apps/code/src/application/runtime/kernel/")),
  },
  {
    id: "runtime-operations-facade-retired",
    description:
      "product code must not import retired `runtimeOperationsFacade`; use backendPool/overlayConnectivity/automationSchedules facades instead",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/facades\/runtimeOperationsFacade["']|import\(\s*["'][^"']*\/application\/runtime\/facades\/runtimeOperationsFacade["'])/u,
    appliesTo: (filePath) => isAppSourceFile(filePath) && !isUiTestFile(filePath),
  },
  {
    id: "runtime-kernel-bindings",
    description:
      "`createDesktopWorkspaceClientBindings` must consume RuntimeKernel instead of assembling runtime ports directly",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/(?:runtimeClientMode|runtimeWebGatewayConfig|runtimeClient|tauriAppSettings|tauriOauth|tauriModels|tauriWorkspaceCatalog|tauriSettings|tauriWorkspaces)["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/(?:runtimeClientMode|runtimeWebGatewayConfig|runtimeClient|tauriAppSettings|tauriOauth|tauriModels|tauriWorkspaceCatalog|tauriSettings|tauriWorkspaces)["']\s*\))/u,
    appliesTo: (filePath) =>
      filePath === "apps/code/src/web/createDesktopWorkspaceClientBindings.tsx",
  },
  {
    id: "desktop-host-facade-only",
    description:
      "product code must use `application/runtime/facades/desktopHostFacade` instead of importing desktop host adapter ports directly",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/(?:tauriEnvironment|tauriOpener)["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/(?:tauriEnvironment|tauriOpener)["'])/u,
    appliesTo: (filePath) =>
      (isUiBoundaryFile(filePath) || isNonUiAppProductFile(filePath)) && !isUiTestFile(filePath),
  },
  {
    id: "runtime-webmcp-type-surface",
    description:
      "type-only imports must use `application/runtime/types/webMcpBridge` instead of the behavior port",
    pattern:
      /(?:import\s+type\s+[^;]*from\s+["'][^"']*\/application\/runtime\/ports\/webMcpBridge["']|import\s*\{[^}]*\btype\s+[A-Za-z0-9_$]+\b[^}]*\}\s*from\s+["'][^"']*\/application\/runtime\/ports\/webMcpBridge["'])/u,
    appliesTo: (filePath) => isAppSourceFile(filePath) && !isUiTestFile(filePath),
    scope: "source",
  },
  {
    id: "runtime-infrastructure-port",
    description:
      "product code must not import `application/runtime/ports/runtimeInfrastructure`; use narrower ports or DI/context entrypoints instead",
    pattern:
      /(?:from\s+["'][^"']*\/application\/runtime\/ports\/runtimeInfrastructure["']|import\(\s*["'][^"']*\/application\/runtime\/ports\/runtimeInfrastructure["'])/u,
    appliesTo: (filePath) => isAppSourceFile(filePath) && !isUiTestFile(filePath),
  },
  {
    id: "runtime-host-contract-compat-subpath",
    description:
      "compat-only runtime host contract symbols must use `@ku0/code-runtime-host-contract/codeRuntimeRpcCompat` instead of the package root",
    pattern:
      /import\s*\{[\s\S]*\b(?:CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES|CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES|CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY|buildCodeRuntimeRpcCompatFields|cloneWithCodeRuntimeRpcCompatAliases|canonicalizeModelPool|canonicalizeModelProvider|canonicalizeOAuthProviderId|inferCodeRuntimeRpcMethodNotFoundCodeFromMessage|isCodeRuntimeRpcMethodNotFoundErrorCode|listCodeRuntimeRpcAllMethods|listCodeRuntimeRpcMethodCandidates|resolveCodeRuntimeRpcMethod)\b[\s\S]*\}\s*from\s+["']@ku0\/code-runtime-host-contract["']/u,
    appliesTo: isAppSourceFile,
  },
  {
    id: "runtime-infrastructure",
    description: "no direct `infrastructure/runtime/*` import",
    pattern:
      /(?:from\s+["'][^"']*\/infrastructure\/runtime\/|import\(\s*["'][^"']*\/infrastructure\/runtime\/)/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "loro-import",
    description: "no direct `loro-crdt` import in UI code",
    pattern: /from\s+["']loro-crdt["']/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "block-tree-access",
    description: "no direct block tree reads from UI code",
    pattern: /readBlockTree\s*\(|getRootBlocks\s*\(/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "runtime-doc-access",
    description: "no direct `runtime.doc.*` access from UI code",
    pattern:
      /runtime\.doc\.(?:getMap|getList|getText|subscribe|frontiers|version|setPeerId|peerIdStr)/u,
    appliesTo: isUiBoundaryFile,
  },
  {
    id: "desktop-host-global-access",
    description:
      "UI and product code must not read `window.hugeCodeDesktopHost` directly; use runtime ports or platform adapters",
    pattern: /window\.hugeCodeDesktopHost/u,
    appliesTo: (filePath) =>
      (isUiBoundaryFile(filePath) || isNonUiAppProductFile(filePath)) && !isUiTestFile(filePath),
  },
  {
    id: "electron-import",
    description:
      "UI and product code must not import Electron renderer APIs directly; use runtime ports or platform adapters",
    pattern: /(?:from\s+["']electron["']|import\(\s*["']electron["']\s*\)|\bipcRenderer\b)/u,
    appliesTo: (filePath) =>
      (isUiBoundaryFile(filePath) || isNonUiAppProductFile(filePath)) && !isUiTestFile(filePath),
  },
];

export function collectUiBoundaryViolationsForSource(filePath, content) {
  const violations = [];
  const lines = content.split(/\r?\n/u);

  for (const rule of VIOLATION_RULES) {
    if (rule.scope !== "source") {
      continue;
    }
    if (rule.appliesTo && !rule.appliesTo(filePath)) {
      continue;
    }
    const match = rule.pattern.exec(content);
    if (!match || match.index === undefined) {
      continue;
    }
    const line = resolveLineNumberForIndex(content, match.index);
    violations.push({
      filePath,
      line,
      rule: rule.id,
      ruleDescription: rule.description,
      snippet: lines[line - 1]?.trim() ?? "",
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const snippet = line.trim();

    for (const rule of VIOLATION_RULES) {
      if (rule.scope === "source") {
        continue;
      }
      if (rule.appliesTo && !rule.appliesTo(filePath)) {
        continue;
      }
      if (!rule.pattern.test(line)) {
        continue;
      }
      violations.push({
        filePath,
        line: index + 1,
        rule: rule.id,
        ruleDescription: rule.description,
        snippet,
      });
    }
  }

  if (
    !isUiTestFile(filePath) &&
    (isFeatureComponentHookFile(filePath) || isUiBoundaryFile(filePath))
  ) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!TAURI_IMPORT_PATTERN.test(line)) {
        continue;
      }
      violations.push({
        filePath,
        line: index + 1,
        rule: "tauri-import",
        ruleDescription:
          "direct `@tauri-apps/api` or `@tauri-apps/plugin` imports are not allowed in feature/component/hook UI code",
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

export function collectUiBoundaryViolations(repoRoot, files) {
  const violations = [];

  for (const filePath of files) {
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    let content = "";
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    violations.push(...collectUiBoundaryViolationsForSource(filePath, content));
  }

  return violations;
}

export function collectUiBoundaryCandidates(repoRoot, env = process.env) {
  const fromEnv = listFilesFromEnv(env).filter(isCandidateFile);
  if (fromEnv.length > 0) {
    return [...new Set(fromEnv)].sort((left, right) => left.localeCompare(right));
  }
  const allFiles = [...listAllUiFiles(repoRoot), ...listAllAppSourceFiles(repoRoot)].filter(
    isCandidateFile
  );
  return [...new Set(allFiles)].sort((left, right) => left.localeCompare(right));
}

export function shouldRunUiServiceBoundaryGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    if (
      filePath === "scripts/check-ui-service-boundary.mjs" ||
      filePath === "scripts/lib/ui-service-boundary.mjs" ||
      filePath === "tests/scripts/ui-service-boundary.test.ts"
    ) {
      return true;
    }
    if (UI_ROOTS.some((prefix) => filePath.startsWith(prefix))) {
      return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    }
    if (UI_ENTRY_FILES.has(filePath)) {
      return true;
    }
    if (filePath.startsWith(RUNTIME_ARCHITECTURE_ROOT)) {
      return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    }
    return isNonUiAppProductFile(filePath);
  });
}

export function explainLegacyRuntimeBridgeExceptions() {
  return [];
}
