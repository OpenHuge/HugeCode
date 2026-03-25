#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadE2EMapConfig, recommendE2ECategoriesFromPaths } from "./lib/e2e-map.mjs";
import { resolveGitComparisonBase, tryReadGitStdout } from "./lib/git-base-ref.mjs";
import { resolveLocalBinaryCommand } from "./lib/local-bin.mjs";
import { formatProcessTree, terminateProcessTree } from "./lib/process-tree.mjs";
import { createValidateTempManager } from "./lib/validate-temp-config.mjs";
import {
  WINDOWS_SDK_COMPONENT_HINT,
  findWindowsSdkLayout,
  loadWindowsMsvcEnv,
} from "./lib/windows-host.mjs";

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const dryRun = argv.has("--dry-run");
const forceFull = argv.has("--full");
const targetedOnly = argv.has("--targeted-only");
const allowRiskyTargeted = argv.has("--allow-risky-targeted");
const skipLint = argv.has("--skip-lint");
const skipTypecheck = argv.has("--skip-typecheck");
const skipTests = argv.has("--skip-tests");
const runE2E = argv.has("--run-e2e");
const repoRoot = process.cwd();
const windowsMsvcEnv = loadWindowsMsvcEnv({ repoRoot });
const validateTempManager = createValidateTempManager();

process.on("exit", () => {
  try {
    validateTempManager.cleanup();
  } catch {
    // ignore temp cleanup failures on process exit
  }
});

function assertWindowsRustToolchainPrereqs() {
  if (process.platform !== "win32") {
    return;
  }

  const windowsSdkLayout = findWindowsSdkLayout();
  if (windowsSdkLayout) {
    return;
  }

  throw new Error(
    `Windows SDK was not found on this machine. Install the Visual Studio component \`${WINDOWS_SDK_COMPONENT_HINT}\` (Windows 11 SDK 10.0.22621.0), then rerun \`pnpm validate:full\`.`
  );
}

const explicitE2EArg = rawArgs.find((arg) => arg.startsWith("--e2e="));
const explicitE2ECategories = explicitE2EArg
  ? explicitE2EArg
      .slice("--e2e=".length)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  : [];

const DOC_NAMES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "task.md",
  "walkthrough.md",
  "implementation_plan.md",
  "LICENSE",
  "CONTRIBUTING.md",
]);

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst", ".adoc"]);
const OXLINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const OXFMT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".css",
  ".md",
]);
const TEST_RELATED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs"]);
const TYPECHECK_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
]);

const FULL_GATE_EXACT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  ".oxlintrc.json",
  ".oxfmtrc.json",
  "tsconfig.base.json",
  "vitest.config.ts",
  "vitest.shared.ts",
  "vitest.workspace.ts",
  ".codex/config.toml",
  "scripts/config/code-bundle-budget.config.mjs",
  "scripts/check-repo-sot.mjs",
  "scripts/check-workflow-governance.mjs",
  "scripts/workflow-list.mjs",
]);
const FULL_GATE_FRONTEND_WIDE_EXACT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "vitest.config.ts",
  "vitest.shared.ts",
  "vitest.workspace.ts",
  "scripts/check-circular-deps.mjs",
  "scripts/check-frontend-file-size.mjs",
  "scripts/check-code-bundle-budget.mjs",
  "scripts/report-code-bundle.mjs",
  "scripts/check-global-style-boundary.mjs",
  "scripts/check-duplicate-global-selectors.mjs",
  "scripts/check-stale-style-selectors.mjs",
]);
const FULL_GATE_REPO_WIDE_UNIT_EXACT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "vitest.config.ts",
  "vitest.shared.ts",
  "vitest.workspace.ts",
]);
const FULL_GATE_SELF_COVERED_SCRIPT_PATHS = new Set([
  "scripts/check-runtime-port-exports.mjs",
  "scripts/check-no-wildcard-exports.mjs",
  "scripts/check-native-runtime-parity.mjs",
  "scripts/check-runtime-sot.mjs",
  "scripts/check-design-runtime-sot.mjs",
  "scripts/check-ui-service-boundary.mjs",
  "scripts/check-code-bundle-budget.mjs",
  "scripts/report-code-bundle.mjs",
  "scripts/check-style-color-sot.mjs",
  "scripts/check-style-semantic-primitives.mjs",
  "scripts/check-theme-token-parity.mjs",
  "scripts/check-legacy-style-classes.mjs",
  "scripts/check-style-module-file-names.mjs",
  "scripts/check-button-semantics.mjs",
  "scripts/check-inline-styles.mjs",
  "scripts/check-style-stack.mjs",
  "scripts/check-duplicate-global-selectors.mjs",
  "scripts/check-stale-style-selectors.mjs",
  "scripts/check-style-budgets.mjs",
  "scripts/check-global-style-boundary.mjs",
  "scripts/check-style-bridge-files.mjs",
  "scripts/check-feature-style-islands.mjs",
  "scripts/check-design-system-ownership.mjs",
  "scripts/check-design-system-surface-semantics.mjs",
  "scripts/check-llm-scaffolding.mjs",
]);
const FULL_GATE_WORKFLOW_GOVERNANCE_PATHS = new Set([
  "scripts/check-workflow-governance.mjs",
  "scripts/workflow-list.mjs",
]);

const FULL_GATE_PREFIXES = [".github/workflows/", ".github/actions/"];
const DEDICATED_VALIDATE_GUARD_PATHS = new Set([
  "scripts/validate.mjs",
  "scripts/lib/validate-temp-config.mjs",
  "scripts/lib/process-tree.mjs",
  "scripts/check-test-placeholders.mjs",
  "scripts/check-llm-scaffolding.mjs",
  "tests/scripts/validate.test.ts",
  "tests/scripts/validate-temp-config.test.ts",
  "tests/scripts/check-test-placeholders.test.ts",
  "tests/scripts/check-llm-scaffolding.test.ts",
]);
const VALIDATION_CACHE_PATH = ".codex/validate-cache.json";
const VALIDATION_CACHE_VERSION = 2;
const CODE_RUNTIME_HOST_CONTRACT_VERSION_SOURCE_PATH =
  "packages/code-runtime-host-contract/src/codeRuntimeRpc.ts";
const CODE_RUNTIME_RPC_CONTRACT_VERSION = (() => {
  const sourcePath = path.join(repoRoot, CODE_RUNTIME_HOST_CONTRACT_VERSION_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, "utf8");
  const match = source.match(/CODE_RUNTIME_RPC_CONTRACT_VERSION\s*=\s*"([^"]+)"/u);
  if (!match?.[1]) {
    throw new Error(
      `Failed to resolve CODE_RUNTIME_RPC_CONTRACT_VERSION from ${CODE_RUNTIME_HOST_CONTRACT_VERSION_SOURCE_PATH}`
    );
  }
  return match[1];
})();
const CODE_RUNTIME_RPC_SPEC_PATH = `docs/runtime/spec/code-runtime-rpc-spec.${CODE_RUNTIME_RPC_CONTRACT_VERSION}.json`;
const CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX = "packages/code-runtime-host-contract/";
const NATIVE_RUNTIME_HOST_CONTRACT_PATH_PREFIX = "packages/native-runtime-host-contract/";
const CODE_RUNTIME_SERVICE_PATH_PREFIX = "packages/code-runtime-service-rs/src/";
const CODE_RUNTIME_RUST_CAPABILITIES_TEST_NAME =
  "lib_tests::rpc_capabilities_returns_method_catalog";
const CODE_TAURI_RUNTIME_PATH_PREFIX = "apps/code-tauri/src-tauri/";
const CODE_TAURI_RUNTIME_CAPABILITIES_TEST_NAME =
  "tests::rpc_capabilities_payload_matches_frozen_spec_and_gap_allowlist";
const CODE_WEB_RUNTIME_CLIENT_PATH_PREFIX = "apps/code/src/services/runtimeClient";
const CODE_WEB_RUNTIME_CLIENT_CONSUMER_PATH_PREFIXES = [
  CODE_WEB_RUNTIME_CLIENT_PATH_PREFIX,
  "apps/code/src/application/runtime/",
];
const CODE_WEB_RUNTIME_CLIENT_CONTRACT_TEST_PATH = "src/services/runtimeClient.test.ts";
const CODE_WEB_RUNTIME_CLIENT_CONTRACT_TEST_REPO_PATH = `apps/code/${CODE_WEB_RUNTIME_CLIENT_CONTRACT_TEST_PATH}`;
const REVIEW_PACK_SELECTION_FLOW_TEST_REPO_PATH =
  "tests/scripts/review-pack-selection-flow.test.ts";
const REVIEW_PACK_SELECTION_FLOW_TRIGGER_PATHS = [
  "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts",
  "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts",
  "apps/code/src/application/runtime/ports/tauriRuntimeJobs.ts",
  "apps/code/src/application/runtime/ports/tauriAppSettings.ts",
  "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
  REVIEW_PACK_SELECTION_FLOW_TEST_REPO_PATH,
];
const RUNTIME_CONTRACT_CACHE_KEY = "lastSuccessfulRuntimeContractChecks";
const APPS_CODE_TARGETED_TEST_CACHE_KEY = "lastSuccessfulAppsCodeTargetedChecks";
const LEGACY_IDENTIFIER_GUARDS = [
  "@ku0/agent-runtime",
  "packages/agent-runtime",
  "apps/desktop",
  "desktop-tauri",
  "agent-runtime-",
];
const LOCAL_EPHEMERAL_PATH_PREFIXES = [
  ".playwright-cli/",
  "artifacts/figma-codegen/",
  ".figma-workflow/figma-exports/",
  ".figma-workflow/figma-exports-validation/",
];
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const STYLE_ROOT_PREFIX = "apps/code/src/styles/";
const SEMANTIC_STYLE_GUARD_PREFIXES = ["apps/code/src/"];
const COLOR_SOT_GUARD_PREFIXES = ["apps/code/src/", "packages/design-system/src/"];
const THEME_TOKEN_PARITY_TRIGGER_PATHS = new Set([
  "apps/code/src/styles/tokens/themeContract.css.ts",
  "apps/code/src/styles/tokens/themes.css.ts",
  "apps/code/src/styles/tokens/themeValues.ts",
  "scripts/check-theme-token-parity.mjs",
]);
const DESIGN_SYSTEM_FAMILY_ADOPTION_TRIGGER_PATHS = new Set([
  "apps/code/src/features/composer/components/ComposerMetaBarControls.tsx",
  "apps/code/src/features/home/components/Home.tsx",
  "apps/code/src/features/review/components/ReviewPackSurface.tsx",
  "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
  "apps/code/src/features/app/components/Sidebar.tsx",
  "apps/code/src/features/app/components/MainHeader.tsx",
  "apps/code/src/features/composer/components/ComposerInput.tsx",
  "apps/code/src/features/prompts/components/PromptPanel.tsx",
  "apps/code/src/features/app/components/AppModals.tsx",
  "apps/code/src/features/workspaces/components/WorktreePrompt.tsx",
  "apps/code/src/features/mobile/components/MobileServerSetupWizard.tsx",
  "apps/code/src/features/settings/components/sections/settings-backend-pool/AcpBackendEditorDialog.tsx",
  "apps/code/src/features/shared/components/FileEditorCard.tsx",
  "apps/code/src/features/git/components/GitDiffPanelModeContent.tsx",
  "apps/code/src/design-system/components/ModalShell.tsx",
  "packages/design-system/src/components/Input.tsx",
  "packages/design-system/src/components/Select.tsx",
  "packages/design-system/src/components/Textarea.tsx",
  "packages/design-system/src/components/Checkbox.tsx",
  "packages/design-system/src/components/Switch.tsx",
  "packages/design-system/src/components/RadioGroup.tsx",
]);
const DESIGN_SYSTEM_SURFACE_SEMANTICS_TRIGGER_PATHS = new Set([
  "scripts/check-design-system-surface-semantics.mjs",
  "scripts/lib/design-system-app-surface-config.mjs",
  "tests/scripts/check-design-system-surface-semantics.test.ts",
  "apps/code/src/design-system/index.ts",
  "apps/code/src/design-system/components/Icon.tsx",
  "apps/code/src/design-system/components/IconButton.tsx",
  "apps/code/src/design-system/components/ModalCardPresets.css.ts",
  "apps/code/src/design-system/components/ModalShell.test.tsx",
  "apps/code/src/design-system/components/ModalShell.tsx",
  "apps/code/src/design-system/components/execution/ActivityLogRow.tsx",
  "apps/code/src/design-system/components/execution/DiffReviewPanel.tsx",
  "apps/code/src/design-system/components/execution/ExecutionPrimitives.css.ts",
  "apps/code/src/design-system/components/execution/ExecutionPrimitives.test.tsx",
  "apps/code/src/design-system/components/execution/ExecutionStatusPill.tsx",
  "apps/code/src/design-system/components/execution/ToolCallChip.tsx",
  "apps/code/src/design-system/components/execution/executionStatus.ts",
  "apps/code/src/design-system/components/modal/ModalPrimitives.test.tsx",
  "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
  "apps/code/src/design-system/components/panel/PanelPrimitives.test.tsx",
  "apps/code/src/design-system/components/panel/PanelPrimitives.tsx",
  "apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx",
  "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
  "apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx",
  "apps/code/src/design-system/components/shell/ShellPrimitives.tsx",
  "apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx",
  "apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx",
  "apps/code/src/design-system/components/toast/ToastPrimitives.test.tsx",
  "apps/code/src/design-system/components/toast/ToastPrimitives.tsx",
]);
const FRONTEND_SIZE_GUARD_PATH_PREFIXES = ["apps/code/src/", "packages/design-system/src/"];
const FRONTEND_SIZE_GUARD_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const FRONTEND_SIZE_GUARD_TEST_MARKERS = [".test.", ".spec.", ".stories."];
const FRONTEND_OPTIMIZATION_GUARD_TRIGGER_PATHS = [
  "apps/code/",
  "packages/design-system/",
  "scripts/check-code-bundle-budget.mjs",
  "scripts/report-code-bundle.mjs",
  "scripts/config/code-bundle-budget.config.mjs",
];
const FIGMA_PIPELINE_GUARD_PREFIXES = [
  "scripts/figma-json-bridge/",
  "scripts/figma-pipeline/",
  "docs/design-system/figma-",
  "docs/design-system/schemas/",
  ".agent/workflows/figma-",
];
const APPS_CODE_PACKAGE_DIR = "apps/code";
const APPS_CODE_FALLBACK_TEST_TIMEOUT_MS = (() => {
  const raw = process.env.VALIDATE_APPS_CODE_FALLBACK_TIMEOUT_MS;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600_000;
})();
const APPS_CODE_RELATED_MAX_WORKERS = (() => {
  const raw = process.env.VALIDATE_APPS_CODE_RELATED_MAX_WORKERS;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
})();
const APPS_CODE_RELATED_BROWSER_MAX_WORKERS = (() => {
  const raw = process.env.VALIDATE_APPS_CODE_RELATED_BROWSER_MAX_WORKERS;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "50%";
})();
const APPS_CODE_RELATED_JSDOM_MAX_WORKERS = (() => {
  const raw = process.env.VALIDATE_APPS_CODE_RELATED_JSDOM_MAX_WORKERS;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "75%";
})();

const CHUNK_SIZE = 80;
const packageScriptsCache = new Map();
const packageVitestConfigCache = new Map();
let appsCodeTrackedVitestFilesCache = null;
let appsCodeTrackedVitestCoverageMapCache = null;
const e2eConfig = loadE2EMapConfig({ repoRoot });

function isRuntimeContractRelatedFile(filePath) {
  const normalized = toPosixPath(filePath);
  return (
    normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
    normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
    normalized.startsWith(CODE_RUNTIME_SERVICE_PATH_PREFIX) ||
    normalized.startsWith(CODE_TAURI_RUNTIME_PATH_PREFIX) ||
    CODE_WEB_RUNTIME_CLIENT_CONSUMER_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function shellQuote(token) {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(token)) {
    return token;
  }
  return `'${token.replace(/'/gu, "'\\''")}'`;
}

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function listFromGit(args) {
  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosixPath);
  } catch (error) {
    const command = ["git", ...args].map(shellQuote).join(" ");
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr || "").trim()
        : "";
    const detail = stderr || (error instanceof Error ? error.message : String(error));

    if (detail) {
    }
    process.exit(1);
  }
}

function collectLocalChangedFiles() {
  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])]
    .filter(
      (filePath) => !LOCAL_EPHEMERAL_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))
    )
    .sort((left, right) => left.localeCompare(right));
}

function collectCommittedBranchDiffFiles() {
  const currentBranch = tryReadGitStdout(repoRoot, ["branch", "--show-current"]);
  if (!currentBranch) {
    return [];
  }

  const { ref: baseRef } = resolveGitComparisonBase({ repoRoot });
  if (!baseRef) {
    return [];
  }

  const mergeBase = tryReadGitStdout(repoRoot, ["merge-base", "HEAD", baseRef]);
  if (!mergeBase) {
    return [];
  }

  return listFromGit([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "--relative",
    mergeBase,
    "HEAD",
  ]).filter(
    (filePath) => !LOCAL_EPHEMERAL_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

function collectChangedFiles() {
  const localChangedFiles = collectLocalChangedFiles();
  if (localChangedFiles.length > 0) {
    return localChangedFiles;
  }
  return collectCommittedBranchDiffFiles();
}

function fileExists(repoRelativePath) {
  return fs.existsSync(path.join(repoRoot, repoRelativePath));
}

function hashFileContents(repoRelativePath) {
  try {
    const absolutePath = path.join(repoRoot, repoRelativePath);
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      return null;
    }
    const content = fs.readFileSync(absolutePath);
    return createHash("sha1").update(content).digest("hex");
  } catch {
    return null;
  }
}

function loadValidationCache() {
  const cachePath = path.join(repoRoot, VALIDATION_CACHE_PATH);
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.version !== VALIDATION_CACHE_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeValidationCache(cacheValue) {
  const cachePath = path.join(repoRoot, VALIDATION_CACHE_PATH);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cacheValue, null, 2)}\n`, "utf8");
}

function collectHighImpactFileHashes(highImpactFiles) {
  /** @type {Record<string, string>} */
  const hashes = {};
  for (const filePath of highImpactFiles) {
    const hash = hashFileContents(filePath);
    if (!hash) {
      continue;
    }
    hashes[filePath] = hash;
  }
  return hashes;
}

function hasHighImpactChangesSinceLastFullGate(highImpactHashes, validationCache) {
  const previousHashes = validationCache?.lastSuccessfulFullGate?.highImpactFileHashes;
  if (!previousHashes || typeof previousHashes !== "object") {
    return true;
  }

  for (const [filePath, currentHash] of Object.entries(highImpactHashes)) {
    if (!currentHash) {
      return true;
    }
    if (previousHashes[filePath] !== currentHash) {
      return true;
    }
  }

  return false;
}

function updateFullGateSnapshot(highImpactFiles, highImpactHashes = null) {
  const nextCache = loadValidationCache() ?? {};
  nextCache.version = VALIDATION_CACHE_VERSION;
  nextCache.lastSuccessfulFullGate = {
    updatedAt: new Date().toISOString(),
    highImpactFileHashes:
      highImpactHashes && Object.keys(highImpactHashes).length > 0
        ? highImpactHashes
        : collectHighImpactFileHashes(highImpactFiles),
  };
  writeValidationCache(nextCache);
}

function haveExactSameHashes(currentHashes, previousHashes) {
  if (!previousHashes || typeof previousHashes !== "object") {
    return false;
  }

  const currentEntries = Object.entries(currentHashes).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const previousEntries = Object.entries(previousHashes).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  if (currentEntries.length !== previousEntries.length) {
    return false;
  }

  for (let index = 0; index < currentEntries.length; index += 1) {
    const [currentFilePath, currentHash] = currentEntries[index];
    const [previousFilePath, previousHash] = previousEntries[index];
    if (currentFilePath !== previousFilePath || currentHash !== previousHash) {
      return false;
    }
  }

  return true;
}

function updateRuntimeContractSnapshot(runtimeContractHashes) {
  const nextCache = loadValidationCache() ?? {};
  nextCache.version = VALIDATION_CACHE_VERSION;
  nextCache[RUNTIME_CONTRACT_CACHE_KEY] = {
    updatedAt: new Date().toISOString(),
    relevantFileHashes: runtimeContractHashes,
  };
  writeValidationCache(nextCache);
}

function updateAppsCodeTargetedTestSnapshot(relevantFileHashes) {
  const nextCache = loadValidationCache() ?? {};
  nextCache.version = VALIDATION_CACHE_VERSION;
  nextCache[APPS_CODE_TARGETED_TEST_CACHE_KEY] = {
    updatedAt: new Date().toISOString(),
    relevantFileHashes,
  };
  writeValidationCache(nextCache);
}

function isDocFile(repoRelativePath) {
  const normalized = toPosixPath(repoRelativePath);
  const baseName = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized).toLowerCase();

  if (normalized.startsWith("docs/")) {
    return true;
  }
  if (normalized.startsWith(".github/") && DOC_EXTENSIONS.has(extension)) {
    return true;
  }
  if (DOC_NAMES.has(baseName)) {
    return true;
  }
  return DOC_EXTENSIONS.has(extension);
}

function requiresFullGate(repoRelativePath) {
  const normalized = toPosixPath(repoRelativePath);
  if (FULL_GATE_SELF_COVERED_SCRIPT_PATHS.has(normalized)) {
    return false;
  }
  if (FULL_GATE_EXACT_FILES.has(normalized)) {
    return true;
  }
  if (FULL_GATE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (/^(apps|packages|tests)\/[^/]+\/package\.json$/u.test(normalized)) {
    return true;
  }
  return /^(?:scripts\/(?:codex-.*|validate|check-rust-file-size|check-runtime-layering|check-runtime-port-exports|check-native-runtime-parity|check-no-wildcard-exports|check-runtime-sot|check-design-runtime-sot|check-ui-service-boundary|check-frontend-file-size|check-code-bundle-budget|report-code-bundle|check-style-color-tokens|check-style-color-sot|check-style-semantic-primitives|check-theme-token-parity|check-legacy-style-classes|check-style-module-file-names|check-button-semantics|check-inline-styles|check-style-stack|check-duplicate-global-selectors|check-stale-style-selectors|check-style-budgets|check-global-style-boundary|check-style-bridge-files|check-feature-style-islands|check-design-system-ownership|check-llm-scaffolding|collect-style-metrics)\.(mjs|js))$/u.test(
    normalized
  );
}

function splitIntoChunks(values, chunkSize) {
  const chunks = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function shouldSkipOxcTarget(filePath) {
  if (filePath.startsWith("apps/code/public/vendor/")) {
    return true;
  }
  return filePath.endsWith(".min.js") || filePath.endsWith(".min.css");
}

function resolveCommandInvocation(command, args) {
  const localBinaryCommand = resolveLocalBinaryCommand(command);
  if (localBinaryCommand) {
    return {
      command: localBinaryCommand,
      args,
      display: [command, ...args],
    };
  }

  if (process.platform === "win32" && command === "pnpm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", ...args],
      display: ["pnpm", ...args],
    };
  }
  if (process.platform === "win32" && command === "node") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "node", ...args],
      display: ["node", ...args],
    };
  }
  return {
    command,
    args,
    display: [command, ...args],
  };
}

function buildCommandEnv(extraEnv = {}) {
  return {
    ...process.env,
    ...(windowsMsvcEnv ?? {}),
    ...extraEnv,
  };
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

function runCommand(command, args, label, options = {}) {
  const invocation = resolveCommandInvocation(command, args);
  const rendered = invocation.display.map(shellQuote).join(" ");

  if (dryRun) {
    return;
  }

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: buildCommandEnv(options.env),
  });

  if (result.error) {
    throw new Error(`${label} failed to start (${result.error.message}).`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
  }
}

function runCommandAsync(command, args, label, options = {}) {
  const invocation = resolveCommandInvocation(command, args);
  const rendered = invocation.display.map(shellQuote).join(" ");

  if (dryRun) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd ?? repoRoot,
      stdio: "inherit",
      env: buildCommandEnv(options.env),
    });
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : null;
    let settled = false;
    let timeoutTriggered = false;
    let timeoutId = null;

    const settle = (error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    child.once("error", (error) => {
      if (timeoutTriggered) {
        return;
      }
      const startError = new Error(`${label} failed to start (${error.message}).`);
      startError.kind = "start";
      startError.label = label;
      startError.rendered = rendered;
      settle(startError);
    });

    child.once("close", (code) => {
      if (settled) {
        return;
      }
      if (timeoutTriggered) {
        return;
      }
      if (code !== 0) {
        const exitError = new Error(`${label} failed with exit code ${code ?? 1}.`);
        exitError.kind = "exit";
        exitError.label = label;
        exitError.rendered = rendered;
        exitError.exitCode = code ?? 1;
        settle(exitError);
        return;
      }
      settle();
    });

    if (timeoutMs !== null && timeoutMs > 0) {
      timeoutId = setTimeout(async () => {
        timeoutTriggered = true;
        const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms.`);
        timeoutError.kind = "timeout";
        timeoutError.label = label;
        timeoutError.rendered = rendered;
        timeoutError.timeoutMs = timeoutMs;
        try {
          const timeoutMetadata = await options.onTimeout?.({ child, label, rendered, timeoutMs });
          if (timeoutMetadata && typeof timeoutMetadata === "object") {
            Object.assign(timeoutError, timeoutMetadata);
          }
        } catch {
          // Preserve the timeout as the primary failure.
        }
        if (Number.isInteger(child.pid) && child.pid > 0) {
          await terminateProcessTree(child.pid, {
            graceMs: options.timeoutGraceMs ?? 750,
          });
        }
        settle(timeoutError);
      }, timeoutMs);
    }
  });
}

function isAppsCodeBrowserRelatedTarget(target) {
  const normalized = toPosixPath(target);
  return normalized.includes(".browser.test.") || normalized.startsWith("src/test/browser/");
}

function isVitestTestFileTarget(target) {
  const normalized = toPosixPath(target);
  return /\.((?:browser\.)?(?:test|spec))\.[^.]+$/u.test(normalized);
}

function toVitestCoverageStem(target) {
  return toPosixPath(target)
    .replace(/\.[^.]+$/u, "")
    .replace(/(?:\.browser)?\.(?:test|spec)$/u, "");
}

function toQualifiedCoverageRoots(target) {
  const stem = toVitestCoverageStem(target);
  const basename = path.posix.basename(stem);
  const qualifierIndex = basename.indexOf(".");
  if (qualifierIndex <= 0) {
    return [stem];
  }
  return [stem, path.posix.join(path.posix.dirname(stem), basename.slice(0, qualifierIndex))];
}

function toIncrementalCoverageScope(target) {
  const segments = toPosixPath(target).split("/").filter(Boolean);
  if (segments.length < 4) {
    return null;
  }
  return segments.slice(0, 3).join("/");
}

function isAppsCodeTestSupportSourceTarget(target) {
  if (isVitestTestFileTarget(target)) {
    return false;
  }
  const stem = path.posix.basename(toVitestCoverageStem(target));
  return /(?:test(?:-|_)?utils?|test(?:-|_)?helpers?|test(?:-|_)?shared|fixtures?|mocks?)$/iu.test(
    stem
  );
}

function listTrackedAppsCodeVitestFiles() {
  if (appsCodeTrackedVitestFilesCache) {
    return appsCodeTrackedVitestFilesCache;
  }
  const repoRelativeFiles = listFromGit(["ls-files", `${APPS_CODE_PACKAGE_DIR}/src`]);
  appsCodeTrackedVitestFilesCache = repoRelativeFiles
    .filter((filePath) => filePath.startsWith(`${APPS_CODE_PACKAGE_DIR}/`))
    .map((filePath) => filePath.slice(`${APPS_CODE_PACKAGE_DIR}/`.length))
    .filter(isVitestTestFileTarget);
  return appsCodeTrackedVitestFilesCache;
}

function buildTrackedAppsCodeVitestCoverageMap() {
  if (appsCodeTrackedVitestCoverageMapCache) {
    return appsCodeTrackedVitestCoverageMapCache;
  }
  const coverageMap = new Map();
  for (const testFile of listTrackedAppsCodeVitestFiles()) {
    for (const root of toQualifiedCoverageRoots(testFile)) {
      const current = coverageMap.get(root);
      if (current) {
        current.push(testFile);
      } else {
        coverageMap.set(root, [testFile]);
      }
    }
  }
  appsCodeTrackedVitestCoverageMapCache = coverageMap;
  return coverageMap;
}

function resolveAppsCodeExplicitDirectTestTargets(target) {
  const normalized = toPosixPath(target);
  const trackedTestFiles = listTrackedAppsCodeVitestFiles();
  const coverageMatches = buildTrackedAppsCodeVitestCoverageMap().get(
    toVitestCoverageStem(normalized)
  );

  if (coverageMatches && coverageMatches.length > 0) {
    return coverageMatches;
  }

  const targetDirectory = path.posix.dirname(normalized);
  if (targetDirectory !== "src") {
    const directoryPrefix = `${targetDirectory}/`;
    const directoryMatches = trackedTestFiles.filter(
      (filePath) =>
        path.posix.dirname(filePath) === targetDirectory || filePath.startsWith(directoryPrefix)
    );
    if (directoryMatches.length > 0) {
      return directoryMatches;
    }
  }

  const scope = toIncrementalCoverageScope(normalized);
  if (scope) {
    const scopePrefix = `${scope}/`;
    const scopeMatches = trackedTestFiles.filter((filePath) => filePath.startsWith(scopePrefix));
    if (scopeMatches.length > 0) {
      return scopeMatches;
    }
  }

  return [];
}

function resolveAppsCodeRelatedMaxWorkers(targets) {
  if (APPS_CODE_RELATED_MAX_WORKERS) {
    return APPS_CODE_RELATED_MAX_WORKERS;
  }
  return targets.some(isAppsCodeBrowserRelatedTarget)
    ? APPS_CODE_RELATED_BROWSER_MAX_WORKERS
    : APPS_CODE_RELATED_JSDOM_MAX_WORKERS;
}

function buildAppsCodeDirectVitestArgs(targets) {
  const args = ["run", "--config", "vitest.config.ts", "--passWithNoTests"];
  args.push(`--maxWorkers=${resolveAppsCodeRelatedMaxWorkers(targets)}`);
  args.push(...targets);
  return args;
}

async function runAppsCodeFallbackPackageTest() {
  const fallbackLabel = "Vitest fallback full package test (apps/code)";
  await runCommandAsync("vitest", ["run", "--config", "vitest.config.ts"], fallbackLabel, {
    cwd: APPS_CODE_PACKAGE_DIR,
    timeoutMs: APPS_CODE_FALLBACK_TEST_TIMEOUT_MS,
    onTimeout: async ({ child, label, rendered, timeoutMs }) => {
      writeStderrLine(`[validate] ${label} timed out after ${timeoutMs}ms.`);
      if (Number.isInteger(child.pid) && child.pid > 0) {
        writeStderrLine(formatProcessTree(child.pid));
      }
      writeStderrLine(`[validate] timed out command: ${rendered}`);
    },
  });
}

async function runAppsCodeDirectTests(targets) {
  for (const chunk of splitIntoChunks([...new Set(targets)], CHUNK_SIZE)) {
    await runCommandAsync(
      "vitest",
      buildAppsCodeDirectVitestArgs(chunk),
      `Vitest direct run (${APPS_CODE_PACKAGE_DIR})`,
      { cwd: APPS_CODE_PACKAGE_DIR }
    );
  }
}

function partitionAppsCodeIncrementalTargets(targets) {
  const dedupedTargets = [...new Set(targets)];
  const directTestTargets = dedupedTargets.filter(isVitestTestFileTarget);
  const sourceTargets = dedupedTargets.filter((target) => !isVitestTestFileTarget(target));
  const expandedDirectTestTargetSet = new Set(directTestTargets);
  const explicitCoverageSourceTargets = new Set();

  for (const target of sourceTargets) {
    const explicitDirectTargets = resolveAppsCodeExplicitDirectTestTargets(target);
    if (explicitDirectTargets.length === 0) {
      continue;
    }
    explicitCoverageSourceTargets.add(target);
    for (const testTarget of explicitDirectTargets) {
      expandedDirectTestTargetSet.add(testTarget);
    }
  }

  const expandedDirectTestTargets = [...expandedDirectTestTargetSet];
  const directCoverageStems = new Set(
    expandedDirectTestTargets.flatMap((target) => toQualifiedCoverageRoots(target))
  );
  const directCoverageScopes = new Set(
    expandedDirectTestTargets
      .map((target) => toIncrementalCoverageScope(target))
      .filter((scope) => typeof scope === "string" && scope.length > 0)
  );
  const directTestDirectories = new Set(
    expandedDirectTestTargets.map((target) => path.posix.dirname(toPosixPath(target)))
  );
  const coveredSourceTargets = sourceTargets.filter(
    (target) =>
      explicitCoverageSourceTargets.has(target) ||
      directCoverageStems.has(toVitestCoverageStem(target)) ||
      (isAppsCodeTestSupportSourceTarget(target) &&
        directTestDirectories.has(path.posix.dirname(toPosixPath(target)))) ||
      (() => {
        const scope = toIncrementalCoverageScope(target);
        return scope !== null && directCoverageScopes.has(scope);
      })()
  );
  const coveredSourceTargetSet = new Set(coveredSourceTargets);
  const uncoveredSourceTargets = sourceTargets.filter(
    (target) => !coveredSourceTargetSet.has(target)
  );

  return {
    directTestTargets: expandedDirectTestTargets,
    coveredSourceTargets,
    uncoveredSourceTargets,
  };
}

function collectAppsCodeTargetedHashes(packageRelativeTargets) {
  return collectHighImpactFileHashes(
    packageRelativeTargets.map((target) => `${APPS_CODE_PACKAGE_DIR}/${toPosixPath(target)}`)
  );
}

async function runAppsCodeIncrementalTests(targets, validationCache) {
  const dedupedTargets = [...new Set(targets)];
  const appsCodeTargetedHashes = collectAppsCodeTargetedHashes(dedupedTargets);
  const previousHashes = validationCache?.[APPS_CODE_TARGETED_TEST_CACHE_KEY]?.relevantFileHashes;
  if (!dryRun && haveExactSameHashes(appsCodeTargetedHashes, previousHashes)) {
    writeStderrLine(
      `[validate] apps/code targeted-tests cache hit: skipping ${dedupedTargets.length} unchanged target${
        dedupedTargets.length === 1 ? "" : "s"
      }.`
    );
    return;
  }

  const sourceTargetsPresent = dedupedTargets.some((target) => !isVitestTestFileTarget(target));
  if (!sourceTargetsPresent) {
    await runAppsCodeDirectTests(dedupedTargets);
    if (!dryRun) {
      updateAppsCodeTargetedTestSnapshot(appsCodeTargetedHashes);
    }
    return;
  }

  const { directTestTargets, coveredSourceTargets, uncoveredSourceTargets } =
    partitionAppsCodeIncrementalTargets(dedupedTargets);

  if (coveredSourceTargets.length > 0) {
    writeStderrLine(
      `[validate] apps/code incremental pruning: ${coveredSourceTargets.length} source target${
        coveredSourceTargets.length === 1 ? "" : "s"
      } covered by changed colocated tests.`
    );
  }

  if (uncoveredSourceTargets.length > 0) {
    if (directTestTargets.length > 0) {
      writeStderrLine(
        `[validate] apps/code incremental dedupe: skipping ${directTestTargets.length} direct test target${
          directTestTargets.length === 1 ? "" : "s"
        } because package fallback already covers them.`
      );
    }
    writeStderrLine(
      `[validate] apps/code incremental fallback: running \`vitest run --config vitest.config.ts\` for ${uncoveredSourceTargets.length} uncovered source target${
        uncoveredSourceTargets.length === 1 ? "" : "s"
      }.`
    );
    await runAppsCodeFallbackPackageTest();
  } else if (directTestTargets.length > 0) {
    await runAppsCodeDirectTests(directTestTargets);
  }
  if (!dryRun) {
    updateAppsCodeTargetedTestSnapshot(appsCodeTargetedHashes);
  }
}

function shouldRunRuntimeRpcSpecCheck(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
      normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith(CODE_RUNTIME_SERVICE_PATH_PREFIX)
    );
  });
}

function shouldRunRuntimeCapabilitiesParityTest(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
      normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith(CODE_RUNTIME_SERVICE_PATH_PREFIX)
    );
  });
}

function shouldRunCodeTauriCapabilitiesParityTest(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
      normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith(CODE_RUNTIME_SERVICE_PATH_PREFIX) ||
      normalized.startsWith(CODE_TAURI_RUNTIME_PATH_PREFIX)
    );
  });
}

function shouldRunCodeWebRuntimeClientContractTest(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
      normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith(CODE_RUNTIME_SERVICE_PATH_PREFIX) ||
      normalized.startsWith(CODE_TAURI_RUNTIME_PATH_PREFIX) ||
      CODE_WEB_RUNTIME_CLIENT_CONSUMER_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    );
  });
}

function shouldRunNativeRuntimeHostContractTest(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === CODE_RUNTIME_RPC_SPEC_PATH ||
      normalized.startsWith(CODE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith(NATIVE_RUNTIME_HOST_CONTRACT_PATH_PREFIX) ||
      normalized.startsWith("packages/code-runtime-service-rs/src/native_runtime.rs") ||
      normalized.startsWith("packages/code-runtime-service-rs/src/rpc/capabilities.rs")
    );
  });
}

function shouldRunReviewPackSelectionFlowTest(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return REVIEW_PACK_SELECTION_FLOW_TRIGGER_PATHS.includes(normalized);
  });
}

async function runRuntimeContractGuardChecks(changedFiles, options = {}) {
  const allowCache = options.allowCache === true;
  const validationCache = options.validationCache ?? null;
  const runtimeContractFiles = changedFiles.filter(isRuntimeContractRelatedFile);
  const runtimeContractHashes =
    runtimeContractFiles.length > 0 ? collectHighImpactFileHashes(runtimeContractFiles) : {};

  if (allowCache && !dryRun && runtimeContractFiles.length > 0) {
    const previousHashes = validationCache?.[RUNTIME_CONTRACT_CACHE_KEY]?.relevantFileHashes;
    if (haveExactSameHashes(runtimeContractHashes, previousHashes)) {
      return;
    }
  }

  const shouldRunRpcSpecCheck = shouldRunRuntimeRpcSpecCheck(changedFiles);
  const shouldRunRuntimeCapabilitiesCheck = shouldRunRuntimeCapabilitiesParityTest(changedFiles);
  const shouldRunTauriCapabilitiesCheck = shouldRunCodeTauriCapabilitiesParityTest(changedFiles);
  const shouldRunWebRuntimeClientContractCheck =
    shouldRunCodeWebRuntimeClientContractTest(changedFiles);
  const shouldRunNativeRuntimeHostContractCheck =
    shouldRunNativeRuntimeHostContractTest(changedFiles);

  const parallelChecks = [];

  if (shouldRunRuntimeCapabilitiesCheck) {
    parallelChecks.push(
      runCommandAsync(
        "pnpm",
        [
          "--filter",
          "@ku0/code-runtime-service-rs",
          "test",
          "--",
          CODE_RUNTIME_RUST_CAPABILITIES_TEST_NAME,
        ],
        "Runtime service capabilities parity test"
      )
    );
  }

  if (shouldRunTauriCapabilitiesCheck) {
    parallelChecks.push(
      runCommandAsync(
        "node",
        [
          "scripts/run-cargo-with-target-guard.mjs",
          "--cwd",
          "apps/code-tauri/src-tauri",
          "test",
          "--manifest-path",
          "Cargo.toml",
          CODE_TAURI_RUNTIME_CAPABILITIES_TEST_NAME,
        ],
        "Code Tauri capabilities parity test"
      )
    );
  }

  if (shouldRunRpcSpecCheck || shouldRunWebRuntimeClientContractCheck) {
    parallelChecks.push(
      (async () => {
        if (shouldRunRpcSpecCheck) {
          await runCommandAsync(
            "pnpm",
            ["--filter", "@ku0/code-runtime-host-contract", "spec:check"],
            "Runtime RPC frozen spec check"
          );
        }
        if (shouldRunWebRuntimeClientContractCheck) {
          await runCommandAsync(
            "pnpm",
            ["--filter", "@ku0/code-runtime-host-contract", "build"],
            "Code runtime host contract build for web client tests"
          );
          await runCommandAsync(
            "vitest",
            ["run", "--config", "vitest.config.ts", CODE_WEB_RUNTIME_CLIENT_CONTRACT_TEST_PATH],
            "Code web runtime gateway client contract test",
            { cwd: APPS_CODE_PACKAGE_DIR }
          );
        }
      })()
    );
  }

  if (shouldRunNativeRuntimeHostContractCheck) {
    parallelChecks.push(
      runCommandAsync(
        "pnpm",
        ["--filter", "@ku0/native-runtime-host-contract", "test"],
        "Native runtime host contract test"
      )
    );
  }

  if (parallelChecks.length === 0) {
    return;
  }

  await Promise.all(parallelChecks);
  if (allowCache && runtimeContractFiles.length > 0 && !dryRun) {
    updateRuntimeContractSnapshot(runtimeContractHashes);
  }
}

async function runFullGate(reason, changedFiles, validationCache) {
  if (shouldRunWorkflowGovernanceGuard(changedFiles)) {
    runCommand("pnpm", ["check:workflow-governance"], "Workflow governance guard");
  }
  if (shouldRunFrontendWideFullGateChecks(changedFiles)) {
    runCommand("pnpm", ["check:app-circular"], "App circular dependency guard");
    runCommand("pnpm", ["check:frontend-file-size:all"], "Frontend file size guard (all)");
    runCommand("pnpm", ["check:style-boundary:all"], "Style boundary guards (all)");
  }
  runCommand("pnpm", ["lint"], "Lint");
  runCommand("pnpm", ["format:check"], "Format");

  runCommand("pnpm", ["typecheck"], "Typecheck");
  if (shouldRunRepoWideUnitTests(changedFiles)) {
    runCommand("pnpm", ["test:unit"], "Unit tests");
  } else {
    writeStderrLine(
      "[validate] full gate: skipping repo-wide `pnpm test:unit`; change set stays within targeted test coverage."
    );
    await runTargetedTestChecks(changedFiles, validationCache);
  }
  await runRuntimeContractGuardChecks(changedFiles);
}

function findWorkspacePackageDir(repoRelativePath) {
  let current = path.dirname(path.join(repoRoot, repoRelativePath));
  const repoRootNormalized = path.normalize(repoRoot);

  while (current.startsWith(repoRootNormalized)) {
    if (current === repoRootNormalized) {
      return null;
    }

    const packageJsonPath = path.join(current, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const relative = toPosixPath(path.relative(repoRoot, current));
      if (
        relative.startsWith("apps/") ||
        relative.startsWith("packages/") ||
        relative.startsWith("tests/")
      ) {
        return relative;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function readPackageScripts(packageDir) {
  if (packageScriptsCache.has(packageDir)) {
    return packageScriptsCache.get(packageDir);
  }

  const packageJsonPath = path.join(repoRoot, packageDir, "package.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const scripts = parsed?.scripts ?? {};
    packageScriptsCache.set(packageDir, scripts);
    return scripts;
  } catch {
    packageScriptsCache.set(packageDir, {});
    return {};
  }
}

function findLocalVitestConfig(packageDir) {
  if (packageVitestConfigCache.has(packageDir)) {
    return packageVitestConfigCache.get(packageDir);
  }

  const candidates = [
    "vitest.config.ts",
    "vitest.config.mts",
    "vitest.config.cts",
    "vitest.config.js",
    "vitest.config.mjs",
    "vitest.config.cjs",
  ];

  for (const fileName of candidates) {
    const configPath = path.join(repoRoot, packageDir, fileName);
    if (fs.existsSync(configPath)) {
      packageVitestConfigCache.set(packageDir, fileName);
      return fileName;
    }
  }

  packageVitestConfigCache.set(packageDir, null);
  return null;
}

function isTypecheckSourceTarget(filePath) {
  if (filePath.startsWith("tests/e2e/")) {
    return false;
  }
  if (filePath.startsWith("scripts/")) {
    return false;
  }
  return TYPECHECK_SOURCE_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

function collectTypecheckTargets(files) {
  const targets = new Map();
  for (const filePath of files) {
    if (!isTypecheckSourceTarget(filePath)) {
      continue;
    }
    const packageDir = findWorkspacePackageDir(filePath);
    if (!packageDir) {
      continue;
    }
    const scripts = readPackageScripts(packageDir);
    if (typeof scripts.typecheck === "string") {
      const relativeFilePath = toPosixPath(path.posix.relative(packageDir, filePath));
      if (!relativeFilePath || relativeFilePath.startsWith("../")) {
        continue;
      }
      const existing = targets.get(packageDir) ?? new Set();
      existing.add(relativeFilePath);
      targets.set(packageDir, existing);
    }
  }
  return targets;
}

function resolveTypecheckProjectPath(typecheckScript) {
  const normalized = typecheckScript.trim();
  if (!/^tsc(?:\s|$)/u.test(normalized)) {
    return null;
  }
  const projectMatch = normalized.match(/(?:^|\s)(?:-p|--project)\s+(['"]?)([^'"\\s]+)\1/u);
  if (projectMatch?.[2]) {
    return projectMatch[2];
  }
  return "tsconfig.json";
}

function createChangedFilesTypecheckConfig(packageDir, projectPath, changedFiles) {
  return validateTempManager.createChangedFilesTypecheckConfig({
    repoRoot,
    packageDir,
    projectPath,
    changedFiles,
  });
}

function printChangedFiles(changedFiles) {
  const previewCount = 20;
  const preview = changedFiles.slice(0, previewCount);
  for (const filePath of preview) {
  }
  if (changedFiles.length > previewCount) {
  }
}

function resolveValidationMode(changedFiles, validationCache) {
  if (forceFull) {
    return {
      mode: "full",
      reason: "`--full` requested",
      highImpactFiles: [],
      highImpactHashes: {},
    };
  }
  if (changedFiles.every(isDocFile)) {
    return {
      mode: "docs-only",
      reason: "Docs-only change detected",
      highImpactFiles: [],
      highImpactHashes: {},
    };
  }
  const highImpactFiles = changedFiles.filter(requiresFullGate);
  const highImpactHashes =
    highImpactFiles.length > 0 ? collectHighImpactFileHashes(highImpactFiles) : {};
  const blockingHighImpactFiles = highImpactFiles.filter(
    (filePath) => !isTargetedHighImpactFile(filePath)
  );
  if (targetedOnly && blockingHighImpactFiles.length > 0) {
    if (!allowRiskyTargeted) {
      return {
        mode: "blocked-targeted",
        reason: `--targeted-only cannot bypass high-impact file ${blockingHighImpactFiles[0]}`,
        highImpactFiles,
        highImpactHashes,
      };
    }
    return {
      mode: "targeted",
      reason: `--targeted-only overrides full gate trigger (${blockingHighImpactFiles[0]})`,
      highImpactFiles,
      highImpactHashes,
    };
  }
  if (highImpactFiles.length > 0 && blockingHighImpactFiles.length === 0) {
    return {
      mode: "targeted",
      reason: "validate guard changes covered by dedicated validate script tests",
      highImpactFiles,
      highImpactHashes,
    };
  }
  if (highImpactFiles.length > 0) {
    if (hasHighImpactChangesSinceLastFullGate(highImpactHashes, validationCache)) {
      return {
        mode: "full",
        reason: `high-impact file changed (${blockingHighImpactFiles[0]})`,
        highImpactFiles,
        highImpactHashes,
      };
    }
    return {
      mode: "targeted",
      reason: "high-impact files unchanged since last successful full validation",
      highImpactFiles,
      highImpactHashes,
    };
  }
  return {
    mode: "targeted",
    reason: "targeted checks applicable",
    highImpactFiles: [],
    highImpactHashes: {},
  };
}

function runChangedFileLint(existingChangedFiles) {
  const oxlintTargets = existingChangedFiles.filter((filePath) => {
    if (isDocFile(filePath)) {
      return false;
    }
    if (shouldSkipOxcTarget(filePath)) {
      return false;
    }
    return OXLINT_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
  });
  const oxfmtTargets = existingChangedFiles.filter((filePath) => {
    if (shouldSkipOxcTarget(filePath)) {
      return false;
    }
    return OXFMT_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
  });

  if (oxlintTargets.length === 0 && oxfmtTargets.length === 0) {
    return;
  }

  for (const chunk of splitIntoChunks(oxlintTargets, CHUNK_SIZE)) {
    runCommand("oxlint", ["--no-ignore", ...chunk], "Oxlint (changed files)");
  }

  for (const chunk of splitIntoChunks(oxfmtTargets, CHUNK_SIZE)) {
    runCommand(
      "oxfmt",
      ["--check", "--no-error-on-unmatched-pattern", "--ignore-path=.gitignore", ...chunk],
      "Oxfmt (changed files)"
    );
  }
}

async function runPackageTypechecks(existingChangedFiles) {
  const typecheckSeeds = existingChangedFiles.filter((filePath) => {
    if (isDocFile(filePath)) {
      return false;
    }
    if (
      filePath === ".codex/config.toml" ||
      filePath.startsWith(".codex/") ||
      filePath.startsWith(".figma-workflow/")
    ) {
      return false;
    }
    if (filePath.includes("/.codex/")) {
      return false;
    }
    return true;
  });
  const rawTypecheckTargets = collectTypecheckTargets(typecheckSeeds);
  const rawTypecheckTargetPackages = [...rawTypecheckTargets.keys()].sort((left, right) =>
    left.localeCompare(right)
  );
  const typecheckTargets = rawTypecheckTargetPackages;
  if (typecheckTargets.length === 0) {
    return;
  }

  const fallbackTypecheckTargets = [];
  const directTypecheckRuns = [];
  for (const packageDir of typecheckTargets) {
    const scripts = readPackageScripts(packageDir);
    const typecheckScript = scripts.typecheck;
    const changedPackageFiles = [...(rawTypecheckTargets.get(packageDir) ?? [])];
    if (typeof typecheckScript !== "string" || changedPackageFiles.length === 0) {
      continue;
    }

    const projectPath = resolveTypecheckProjectPath(typecheckScript);
    if (!projectPath) {
      fallbackTypecheckTargets.push(packageDir);
      continue;
    }

    const tempTypecheckConfig = createChangedFilesTypecheckConfig(
      packageDir,
      projectPath,
      changedPackageFiles
    );
    if (!tempTypecheckConfig) {
      fallbackTypecheckTargets.push(packageDir);
      continue;
    }
    if (tempTypecheckConfig.skipPackageFallback === true) {
      continue;
    }

    directTypecheckRuns.push(
      (async () => {
        try {
          await runCommandAsync(
            "pnpm",
            [
              "-C",
              packageDir,
              "exec",
              "tsc",
              "-p",
              tempTypecheckConfig.configAbsolutePath,
              "--noEmit",
            ],
            `Typecheck changed files (${packageDir})`
          );
        } finally {
          try {
            fs.unlinkSync(tempTypecheckConfig.configAbsolutePath);
          } catch {
            // ignore cleanup failures for temporary configs
          }
        }
      })()
    );
  }

  if (directTypecheckRuns.length > 0) {
    await Promise.all(directTypecheckRuns);
  }

  if (fallbackTypecheckTargets.length > 0) {
    for (const packageDir of fallbackTypecheckTargets) {
    }
    const filterArgs = fallbackTypecheckTargets.flatMap((packageDir) => [
      "--filter",
      `./${packageDir}`,
    ]);
    await runCommandAsync(
      "pnpm",
      ["-r", ...filterArgs, "run", "typecheck"],
      `Typecheck fallback (${fallbackTypecheckTargets.length} package${
        fallbackTypecheckTargets.length === 1 ? "" : "s"
      })`
    );
  }
}

function isVitestRelatedTarget(filePath) {
  if (filePath.startsWith("tests/e2e/")) {
    return false;
  }
  if (filePath.startsWith("scripts/")) {
    return false;
  }
  return TEST_RELATED_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

function classifyRelatedTestPackage(packageDir) {
  if (!packageDir) {
    return "root";
  }
  return "package";
}

function bucketRelatedTestTargets(testRelatedTargets) {
  const rootTargets = [];
  const packageTargets = new Map();

  for (const filePath of testRelatedTargets) {
    const packageDir = findWorkspacePackageDir(filePath);
    const packageMode = classifyRelatedTestPackage(packageDir);
    if (packageMode === "root") {
      rootTargets.push(filePath);
      continue;
    }
    if (packageMode === "skip") {
      continue;
    }

    const packageVitestConfig = findLocalVitestConfig(packageDir);
    const relativePath = toPosixPath(path.posix.relative(packageDir, filePath));
    if (!packageVitestConfig || !relativePath || relativePath.startsWith("../")) {
      rootTargets.push(filePath);
      continue;
    }

    const existing = packageTargets.get(packageDir) ?? [];
    existing.push(relativePath);
    packageTargets.set(packageDir, existing);
  }

  return { rootTargets, packageTargets };
}

async function runPackageRelatedTests(packageTargets, validationCache) {
  const orderedPackages = [...packageTargets.keys()].sort((left, right) =>
    left.localeCompare(right)
  );
  for (const packageDir of orderedPackages) {
    const dedupedTargets = [...new Set(packageTargets.get(packageDir) ?? [])];
    if (packageDir === APPS_CODE_PACKAGE_DIR) {
      await runAppsCodeIncrementalTests(dedupedTargets, validationCache);
      continue;
    }

    for (const chunk of splitIntoChunks(dedupedTargets, CHUNK_SIZE)) {
      await runCommandAsync(
        "vitest",
        ["related", "--run", "--passWithNoTests", ...chunk],
        `Vitest related (${packageDir})`,
        { cwd: packageDir }
      );
    }
  }
}

async function runRootRelatedTests(rootTargets) {
  const dedupedTargets = [...new Set(rootTargets)];
  const directTestTargets = dedupedTargets.filter(isVitestTestFileTarget);
  const relatedTargets = dedupedTargets.filter((target) => !isVitestTestFileTarget(target));

  for (const chunk of splitIntoChunks(directTestTargets, CHUNK_SIZE)) {
    await runCommandAsync(
      "vitest",
      ["run", "--passWithNoTests", ...chunk],
      "Vitest direct run (root)"
    );
  }

  for (const chunk of splitIntoChunks(relatedTargets, CHUNK_SIZE)) {
    await runCommandAsync(
      "vitest",
      ["related", "--run", "--passWithNoTests", ...chunk],
      "Vitest related (root)"
    );
  }
}

async function runRelatedTests(existingChangedFiles, validationCache) {
  const testRelatedTargets = existingChangedFiles.filter(isVitestRelatedTarget);
  if (testRelatedTargets.length === 0) {
    return;
  }

  const shouldRunDedicatedRuntimeClientContractTest =
    shouldRunCodeWebRuntimeClientContractTest(existingChangedFiles);
  const shouldRunDedicatedReviewPackSelectionFlowTest =
    shouldRunReviewPackSelectionFlowTest(existingChangedFiles);
  const shouldRunDedicatedValidateGuardTests = shouldRunValidateScriptTests(existingChangedFiles);
  const filteredRelatedTargets = shouldRunDedicatedRuntimeClientContractTest
    ? testRelatedTargets.filter(
        (filePath) => toPosixPath(filePath) !== CODE_WEB_RUNTIME_CLIENT_CONTRACT_TEST_REPO_PATH
      )
    : testRelatedTargets;
  const filteredDedicatedRootTargets = shouldRunDedicatedReviewPackSelectionFlowTest
    ? filteredRelatedTargets.filter(
        (filePath) => toPosixPath(filePath) !== REVIEW_PACK_SELECTION_FLOW_TEST_REPO_PATH
      )
    : filteredRelatedTargets;
  const dedupedRelatedTargets = shouldRunDedicatedValidateGuardTests
    ? filteredDedicatedRootTargets.filter((filePath) => !isDedicatedValidateGuardFile(filePath))
    : filteredDedicatedRootTargets;

  if (dedupedRelatedTargets.length === 0) {
    return;
  }

  const { rootTargets, packageTargets } = bucketRelatedTestTargets(dedupedRelatedTargets);
  await runPackageRelatedTests(packageTargets, validationCache);
  await runRootRelatedTests(rootTargets);
}

async function runTargetedTestChecks(changedFiles, validationCache = null) {
  if (skipTests) {
    return;
  }

  const existingChangedFiles = changedFiles.filter(fileExists);
  await Promise.all([
    runRelatedTests(existingChangedFiles, validationCache),
    runValidateScriptTests(existingChangedFiles),
    runReviewPackSelectionFlowTest(existingChangedFiles),
  ]);
}

function shouldSkipE2EAutoDetectionPath(normalizedPath) {
  if (isDocFile(normalizedPath) || normalizedPath.startsWith("tests/e2e/")) {
    return true;
  }
  return false;
}

function detectAutoE2ECategories(changedFiles) {
  return recommendE2ECategoriesFromPaths(changedFiles, {
    config: e2eConfig,
    skipPath: shouldSkipE2EAutoDetectionPath,
  });
}

function resolveE2ECategories(changedFiles) {
  if (explicitE2ECategories.length > 0) {
    const validSet = new Set(e2eConfig.categories);
    const normalized = [];
    const seen = new Set();
    for (const category of explicitE2ECategories) {
      const normalizedCategory = category.trim().toLowerCase();
      if (!validSet.has(normalizedCategory) || seen.has(normalizedCategory)) {
        continue;
      }
      seen.add(normalizedCategory);
      normalized.push(normalizedCategory);
    }
    if (normalized.length === 0) {
    }
    return normalized;
  }
  return detectAutoE2ECategories(changedFiles);
}

function runOrSuggestE2E(changedFiles) {
  const categories = resolveE2ECategories(changedFiles);
  if (categories.length === 0) {
    return;
  }

  for (const category of categories) {
  }

  if (runE2E || explicitE2ECategories.length > 0) {
    for (const category of categories) {
      runCommand("pnpm", [`test:e2e:${category}`], `E2E (${category})`);
    }
    return;
  }
}

async function runTargetedChecks(changedFiles, validationCache) {
  const existingChangedFiles = changedFiles.filter(fileExists);
  if (skipLint) {
  } else {
    runChangedFileLint(existingChangedFiles);
  }

  const postLintChecks = [];
  if (skipTypecheck) {
  } else {
    postLintChecks.push(runPackageTypechecks(existingChangedFiles));
  }
  postLintChecks.push(runTargetedTestChecks(changedFiles, validationCache));
  if (postLintChecks.length > 0) {
    await Promise.all(postLintChecks);
  }
  await runRuntimeContractGuardChecks(changedFiles, {
    allowCache: true,
    validationCache,
  });
  runOrSuggestE2E(changedFiles);
}

function shouldRunValidateScriptTests(changedFiles) {
  return changedFiles.some((filePath) => isDedicatedValidateGuardFile(filePath));
}

async function runValidateScriptTests(changedFiles) {
  if (!shouldRunValidateScriptTests(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "tests/scripts/validate.test.ts",
      "tests/scripts/validate-temp-config.test.ts",
      "tests/scripts/check-test-placeholders.test.ts",
      "tests/scripts/check-llm-scaffolding.test.ts",
    ],
    "Validate script guard tests"
  );
}

async function runReviewPackSelectionFlowTest(changedFiles) {
  if (!shouldRunReviewPackSelectionFlowTest(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "pnpm",
    ["test:runtime:review-pack-selection"],
    "Review-pack selection flow regression"
  );
}

function shouldRunLlmScaffoldingGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    if (normalized === "scripts/check-llm-scaffolding.mjs") {
      return true;
    }
    if (
      normalized.startsWith("docs/") ||
      normalized.startsWith(".codex/") ||
      normalized.startsWith(".figma-workflow/")
    ) {
      return false;
    }
    if (!/^(apps|packages|tests|scripts)\//u.test(normalized) && normalized !== "package.json") {
      return false;
    }
    const extension = path.posix.extname(normalized).toLowerCase();
    return extension === ".rs" || OXLINT_EXTENSIONS.has(extension) || extension === ".json";
  });
}

function shouldRunChangedTestPlaceholderGuard(changedFiles) {
  return changedFiles.some((filePath) => isVitestRelatedTarget(filePath));
}

function runLegacyIdentifierGuard(changedFiles) {
  const existingChangedFiles = changedFiles.filter(fileExists);
  const offenders = [];

  for (const filePath of existingChangedFiles) {
    if (filePath === "scripts/validate.mjs") {
      // Skip self-check to avoid matching guard tokens declared in this file.
      continue;
    }

    const absolutePath = path.join(repoRoot, filePath);
    let content;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      // Skip non-text/binary files.
      continue;
    }

    for (const token of LEGACY_IDENTIFIER_GUARDS) {
      if (content.includes(token)) {
        offenders.push({ filePath, token });
      }
    }
  }

  if (offenders.length === 0) {
    return;
  }

  for (const offender of offenders) {
  }
  throw new Error(
    "Please replace legacy identifiers with current code-runtime equivalents before validating."
  );
}

function buildSharedChangedFilesEnv(changedFiles) {
  return {
    [SHARED_CHANGED_FILES_ENV_KEY]: JSON.stringify(changedFiles),
  };
}

function shouldRunRustFileSizeGuard(changedFiles) {
  return changedFiles.some((filePath) => filePath.endsWith(".rs"));
}

function shouldRunRuntimeLayeringGuard(changedFiles) {
  return changedFiles.some((filePath) =>
    filePath.startsWith("packages/code-runtime-service-rs/src/")
  );
}

function shouldRunRuntimePortExportGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    if (normalized === "scripts/check-runtime-port-exports.mjs") {
      return true;
    }
    if (
      normalized.startsWith("apps/code/src/application/runtime/ports/") &&
      normalized.endsWith(".ts")
    ) {
      return true;
    }
    if (normalized.startsWith("apps/code/src/application/runtime/") && normalized.endsWith(".ts")) {
      return true;
    }
    if (
      normalized.startsWith("packages/code-runtime-host-contract/src/") &&
      normalized.endsWith(".ts")
    ) {
      return true;
    }
    if (
      normalized.startsWith("packages/native-runtime-host-contract/src/") &&
      normalized.endsWith(".ts")
    ) {
      return true;
    }
    return false;
  });
}

function shouldRunNoWildcardExportGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    if (normalized === "scripts/check-no-wildcard-exports.mjs") {
      return true;
    }
    if (!/^(apps|packages)\//u.test(normalized)) {
      return false;
    }
    if (!normalized.includes("/src/")) {
      return false;
    }
    if (normalized.endsWith(".d.ts")) {
      return false;
    }
    return normalized.endsWith(".ts") || normalized.endsWith(".tsx");
  });
}

function shouldRunNativeRuntimeParityGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-native-runtime-parity.mjs" ||
      normalized === "packages/code-runtime-service-rs/src/native_runtime.rs" ||
      normalized === "packages/code-runtime-service-rs/src/rpc/capabilities.rs" ||
      normalized === "packages/native-runtime-host-contract/src/nativeRuntimeRpc.ts"
    );
  });
}

function shouldRunRuntimeSotGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-runtime-sot.mjs" ||
      normalized.startsWith("packages/code-runtime-host-contract/") ||
      normalized.startsWith("packages/code-runtime-service-rs/src/") ||
      normalized.startsWith("apps/code-tauri/src-tauri/") ||
      normalized.startsWith("docs/runtime/spec/code-runtime-rpc-spec.") ||
      normalized.startsWith("docs/runtime/spec/code-runtime-rpc-spec.tauri.") ||
      normalized.startsWith("docs/runtime/spec/code-runtime-rpc-tauri-gap-allowlist.")
    );
  });
}

function shouldRunDesignRuntimeSotGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-design-runtime-sot.mjs" ||
      normalized === "apps/code/index.html" ||
      normalized === "apps/code/src/main.tsx" ||
      normalized === "apps/code/src/styles/runtime.css.ts" ||
      normalized.startsWith("apps/code/src/styles/tokens/") ||
      normalized.startsWith("packages/design-system/src/")
    );
  });
}

function shouldRunFeatureStyleIslandsGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-feature-style-islands.mjs" ||
      normalized.startsWith("apps/code/src/features/")
    );
  });
}

function shouldRunDesignSystemOwnershipGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-design-system-ownership.mjs" ||
      normalized === "tests/scripts/check-design-system-ownership.test.ts" ||
      normalized.startsWith("packages/design-system/src/components/") ||
      normalized.startsWith("packages/ui/src/components/") ||
      normalized.startsWith("apps/code/src/design-system/")
    );
  });
}

function shouldRunDesignSystemBaseline(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return (
      normalized === "scripts/check-design-system-barrels.mjs" ||
      normalized === "scripts/check-code-ui-imports.mjs" ||
      normalized === "scripts/check-design-system-storybook-coverage.mjs" ||
      normalized === "scripts/check-design-system-surface-semantics.mjs" ||
      normalized === "scripts/check-design-system-family-contracts.mjs" ||
      normalized === "scripts/check-design-system-family-adoption.mjs" ||
      normalized === "scripts/check-design-system-governance-fixture-coverage.mjs" ||
      normalized === "scripts/check-design-system-operator-adjunct-fixture-coverage.mjs" ||
      normalized === "scripts/run-design-system-fixture-smoke.mjs" ||
      normalized === "scripts/lib/design-system-app-surface-config.mjs" ||
      normalized === "scripts/lib/design-system-family-contract-config.mjs" ||
      normalized === "scripts/lib/design-system-operator-adjunct-fixture-config.mjs" ||
      normalized === "tests/scripts/check-design-system-storybook-coverage.test.ts" ||
      normalized === "tests/scripts/check-design-system-surface-semantics.test.ts" ||
      normalized === "tests/scripts/check-design-system-family-contracts.test.ts" ||
      normalized === "tests/scripts/check-design-system-family-adoption.test.ts" ||
      normalized === "tests/scripts/check-design-system-governance-fixture-coverage.test.ts" ||
      normalized ===
        "tests/scripts/check-design-system-operator-adjunct-fixture-coverage.test.ts" ||
      normalized === "tests/scripts/run-design-system-fixture-smoke.test.ts" ||
      normalized === "tests/e2e/src/code/design-system-fixture-smoke.spec.ts" ||
      normalized === "apps/code/src/fixtures/FixtureApp.tsx" ||
      DESIGN_SYSTEM_SURFACE_SEMANTICS_TRIGGER_PATHS.has(normalized) ||
      DESIGN_SYSTEM_FAMILY_ADOPTION_TRIGGER_PATHS.has(normalized) ||
      normalized === "packages/design-system/package.json" ||
      normalized === "packages/ui/package.json" ||
      normalized.startsWith("packages/design-system/src/") ||
      normalized.startsWith("packages/design-system/tokens/") ||
      normalized.startsWith("packages/ui/src/components/") ||
      normalized.startsWith("apps/code/src/design-system/") ||
      normalized.startsWith("apps/code/src/features/design-system/")
    );
  });
}

function isFrontendSizeGuardSourceFile(filePath) {
  if (!FRONTEND_SIZE_GUARD_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }
  const extension = path.posix.extname(filePath).toLowerCase();
  if (!FRONTEND_SIZE_GUARD_EXTENSIONS.has(extension)) {
    return false;
  }
  if (filePath.endsWith(".d.ts")) {
    return false;
  }
  if (filePath.includes("/__tests__/")) {
    return false;
  }
  if (FRONTEND_SIZE_GUARD_TEST_MARKERS.some((marker) => filePath.includes(marker))) {
    return false;
  }
  return true;
}

function shouldRunFrontendFileSizeGuard(changedFiles) {
  return changedFiles.some(isFrontendSizeGuardSourceFile);
}

function shouldRunStyleColorTokenGuard(changedFiles) {
  return changedFiles.some(
    (filePath) => filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(".css.ts")
  );
}

function isWorkflowGovernanceHighImpactFile(filePath) {
  const normalized = toPosixPath(filePath);
  return (
    FULL_GATE_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    FULL_GATE_WORKFLOW_GOVERNANCE_PATHS.has(normalized)
  );
}

function isTargetedHighImpactFile(filePath) {
  const normalized = toPosixPath(filePath);
  return (
    isDedicatedValidateGuardFile(normalized) ||
    FULL_GATE_SELF_COVERED_SCRIPT_PATHS.has(normalized) ||
    isWorkflowGovernanceHighImpactFile(normalized)
  );
}

function shouldRunWorkflowGovernanceGuard(changedFiles) {
  if (forceFull) {
    return true;
  }

  return changedFiles.some((filePath) => isWorkflowGovernanceHighImpactFile(filePath));
}

function shouldRunStyleColorSotGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-style-color-sot.mjs" ||
      filePath === "scripts/lib/style-guard-config.mjs" ||
      (COLOR_SOT_GUARD_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
        (filePath.endsWith(".css.ts") || filePath.endsWith(".styles.ts")))
  );
}

function shouldRunStyleSemanticPrimitiveGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-style-semantic-primitives.mjs" ||
      filePath === "scripts/lib/style-guard-config.mjs" ||
      (SEMANTIC_STYLE_GUARD_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
        filePath.endsWith(".css.ts"))
  );
}

function shouldRunThemeTokenParityGuard(changedFiles) {
  return changedFiles.some((filePath) => THEME_TOKEN_PARITY_TRIGGER_PATHS.has(filePath));
}

function shouldRunLegacyStyleClassGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-legacy-style-classes.mjs" ||
      (filePath.startsWith("apps/code/src/") && filePath.endsWith(".tsx"))
  );
}

function shouldRunStyleModuleFilenameGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-style-module-file-names.mjs" ||
      (filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(".css.ts"))
  );
}

function shouldRunButtonSemanticsGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-button-semantics.mjs" ||
      (filePath.startsWith("apps/code/src/") && filePath.endsWith(".tsx"))
  );
}

function shouldRunInlineStyleGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-inline-styles.mjs" ||
      ((filePath.startsWith("apps/") || filePath.startsWith("packages/")) &&
        (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")))
  );
}

function shouldRunStyleStackGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    if (filePath === "scripts/check-style-stack.mjs") {
      return true;
    }
    if (
      filePath === "package.json" ||
      filePath === ".oxlintrc.json" ||
      filePath === ".oxfmtrc.json" ||
      filePath === "AGENTS.md"
    ) {
      return true;
    }
    if (filePath === "CODING_STANDARDS.md" || filePath.startsWith(".agent/")) {
      return true;
    }
    if (filePath.startsWith("docs/")) {
      return true;
    }
    if (/^(apps|packages|tests)\/[^/]+\/package\.json$/u.test(filePath)) {
      return true;
    }
    if (
      filePath.startsWith("apps/") ||
      filePath.startsWith("packages/") ||
      filePath.startsWith("tests/")
    ) {
      return (
        filePath.endsWith(".css") ||
        filePath.endsWith(".css.ts") ||
        filePath.endsWith(".ts") ||
        filePath.endsWith(".tsx") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".jsx")
      );
    }
    return false;
  });
}

const UI_SERVICE_BOUNDARY_MAIN_APP_FILES = new Set([
  "apps/code/src/web/WorkspaceAppBridge.tsx",
  "apps/code/src/MainAppCore.tsx",
  "apps/code/src/MainAppContainer.tsx",
  "apps/code/src/MainAppContainerCore.tsx",
]);

function shouldRunUiServiceBoundaryGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    if (
      filePath === "scripts/check-ui-service-boundary.mjs" ||
      filePath === "scripts/lib/ui-service-boundary.mjs" ||
      filePath === "tests/scripts/ui-service-boundary.test.ts"
    ) {
      return true;
    }
    if (
      filePath.startsWith("apps/code/src/features/") ||
      filePath.startsWith("apps/code/src/design-system/") ||
      filePath.startsWith("apps/code/src/hooks/")
    ) {
      return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    }
    return UI_SERVICE_BOUNDARY_MAIN_APP_FILES.has(filePath);
  });
}

function shouldRunDuplicateGlobalSelectorGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-duplicate-global-selectors.mjs" ||
      (filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(".css.ts"))
  );
}

function shouldRunStaleStyleSelectorGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-stale-style-selectors.mjs" ||
      (filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(".css.ts"))
  );
}

function shouldRunStyleBudgetGuard(changedFiles) {
  const styleBudgetProfile = process.env.STYLE_BUDGET_PROFILE?.trim();
  if (styleBudgetProfile && styleBudgetProfile !== "regression") {
    return true;
  }
  if (process.env.STYLE_BUDGET_STRICT === "1" || process.env.STYLE_BUDGET_STRICT === "true") {
    return true;
  }
  if (targetedOnly) {
    return false;
  }
  const touchedStyleBudgetInfrastructure = changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-style-budgets.mjs" ||
      filePath === "scripts/lib/style-metrics.mjs" ||
      filePath === "scripts/collect-style-metrics.mjs" ||
      filePath === ".codex/style-metrics-baseline.json"
  );
  if (touchedStyleBudgetInfrastructure) {
    return true;
  }
  return changedFiles.some(
    (filePath) =>
      filePath.startsWith("apps/code/src/") &&
      (filePath.endsWith(".tsx") || filePath.endsWith(".css.ts"))
  );
}

function shouldRunGlobalStyleBoundaryGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-global-style-boundary.mjs" ||
      (filePath.startsWith("apps/code/src/") && filePath.endsWith(".css.ts"))
  );
}

function shouldRunStyleBridgeGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-style-bridge-files.mjs" ||
      (filePath.startsWith("apps/code/src/features/") && filePath.endsWith(".css.ts"))
  );
}

function shouldRunFrontendOptimizationGuard(changedFiles) {
  if (targetedOnly) {
    return false;
  }
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return FRONTEND_OPTIMIZATION_GUARD_TRIGGER_PATHS.some((prefix) =>
      normalized.startsWith(prefix)
    );
  });
}

function shouldRunFrontendWideFullGateChecks(changedFiles) {
  if (forceFull) {
    return true;
  }

  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    if (FULL_GATE_FRONTEND_WIDE_EXACT_FILES.has(normalized)) {
      return true;
    }
    if (/^(apps|packages)\/[^/]+\/package\.json$/u.test(normalized)) {
      return true;
    }
    return normalized.startsWith("apps/code/") || normalized.startsWith("packages/design-system/");
  });
}

function shouldRunRepoWideUnitTests(changedFiles) {
  if (forceFull) {
    return true;
  }

  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    if (FULL_GATE_REPO_WIDE_UNIT_EXACT_FILES.has(normalized)) {
      return true;
    }
    if (FULL_GATE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      return true;
    }
    if (/^(apps|packages|tests)\/[^/]+\/package\.json$/u.test(normalized)) {
      return true;
    }
    return (
      requiresFullGate(normalized) &&
      !isDedicatedValidateGuardFile(normalized) &&
      !FULL_GATE_SELF_COVERED_SCRIPT_PATHS.has(normalized)
    );
  });
}

function isDedicatedValidateGuardFile(filePath) {
  return DEDICATED_VALIDATE_GUARD_PATHS.has(toPosixPath(filePath));
}

function shouldRunFigmaPipelineGuard(changedFiles) {
  return changedFiles.some((filePath) => {
    const normalized = toPosixPath(filePath);
    return FIGMA_PIPELINE_GUARD_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  });
}

async function runRustFileSizeGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunRustFileSizeGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-rust-file-size.mjs"], "Rust monolith guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runRuntimeLayeringGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunRuntimeLayeringGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-runtime-layering.mjs"], "Runtime layering guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runRuntimePortExportGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunRuntimePortExportGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-runtime-port-exports.mjs"],
    "Runtime port export guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runNoWildcardExportGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunNoWildcardExportGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-no-wildcard-exports.mjs"],
    "No wildcard export guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runNativeRuntimeParityGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunNativeRuntimeParityGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-native-runtime-parity.mjs"],
    "Native runtime parity guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runRuntimeSotGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunRuntimeSotGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-runtime-sot.mjs"], "Runtime SOT guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runDesignRuntimeSotGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunDesignRuntimeSotGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-design-runtime-sot.mjs"],
    "Design runtime source-of-truth guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runFeatureStyleIslandsGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunFeatureStyleIslandsGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-feature-style-islands.mjs"],
    "Feature-global style island guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runDesignSystemOwnershipGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunDesignSystemOwnershipGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-design-system-ownership.mjs"],
    "Design-system ownership guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runDesignSystemBaseline(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunDesignSystemBaseline(changedFiles)) {
    return;
  }
  await runCommandAsync("pnpm", ["check:design-system:baseline"], "Design-system baseline", {
    env: sharedChangedFilesEnv,
  });
}

async function runFrontendFileSizeGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunFrontendFileSizeGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-frontend-file-size.mjs"],
    "Frontend file size guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runStyleColorTokenGuard(changedFiles, sharedChangedFilesEnv) {
  const runAllMode = forceFull;
  if (!runAllMode && !shouldRunStyleColorTokenGuard(changedFiles)) {
    return;
  }
  const args = ["scripts/check-style-color-tokens.mjs"];
  if (runAllMode) {
    args.push("--all");
  }
  await runCommandAsync("node", args, "Style color token guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runStyleSemanticPrimitiveGuard(changedFiles, sharedChangedFilesEnv) {
  const runAllMode = forceFull;
  if (!runAllMode && !shouldRunStyleSemanticPrimitiveGuard(changedFiles)) {
    return;
  }
  const args = ["scripts/check-style-semantic-primitives.mjs"];
  if (runAllMode) {
    args.push("--all");
  }
  await runCommandAsync("node", args, "Style semantic primitive guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runStyleColorSotGuard(changedFiles, sharedChangedFilesEnv) {
  const runAllMode = forceFull;
  if (!runAllMode && !shouldRunStyleColorSotGuard(changedFiles)) {
    return;
  }
  const args = ["scripts/check-style-color-sot.mjs"];
  if (runAllMode) {
    args.push("--all");
  }
  await runCommandAsync("node", args, "Style color/source-of-truth guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runThemeTokenParityGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunThemeTokenParityGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "pnpm",
    ["exec", "tsx", "scripts/check-theme-token-parity.mjs"],
    "Theme token parity guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runLegacyStyleClassGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunLegacyStyleClassGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-legacy-style-classes.mjs"],
    "Legacy style class guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runStyleModuleFilenameGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunStyleModuleFilenameGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-style-module-file-names.mjs"],
    "Style module filename guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runButtonSemanticsGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunButtonSemanticsGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-button-semantics.mjs"], "Button semantics guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runInlineStyleGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunInlineStyleGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-inline-styles.mjs"], "Inline style guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runStyleStackGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunStyleStackGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-style-stack.mjs"], "Style stack guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runUiServiceBoundaryGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunUiServiceBoundaryGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-ui-service-boundary.mjs"],
    "UI service boundary guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runDuplicateGlobalSelectorGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunDuplicateGlobalSelectorGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-duplicate-global-selectors.mjs"],
    "Duplicate global selector guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runStaleStyleSelectorGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunStaleStyleSelectorGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-stale-style-selectors.mjs"],
    "Stale style selector guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runStyleBudgetGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunStyleBudgetGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-style-budgets.mjs"], "Style budget guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runGlobalStyleBoundaryGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunGlobalStyleBoundaryGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-global-style-boundary.mjs"],
    "Global style boundary guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runStyleBridgeGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunStyleBridgeGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-style-bridge-files.mjs"], "Style bridge guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runLlmScaffoldingGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunLlmScaffoldingGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("node", ["scripts/check-llm-scaffolding.mjs"], "LLM scaffolding guard", {
    env: sharedChangedFilesEnv,
  });
}

async function runChangedTestPlaceholderGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunChangedTestPlaceholderGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/check-test-placeholders.mjs"],
    "Changed test placeholder guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runFrontendOptimizationGuard(changedFiles) {
  if (!shouldRunFrontendOptimizationGuard(changedFiles)) {
    return;
  }
  runCommand("pnpm", ["code:build"], "Frontend optimization build (apps/code)");
  runCommand(
    "pnpm",
    ["check:code:bundle-budget", "--", "--json"],
    "Frontend optimization bundle budget"
  );
}

async function runFigmaPipelineGuard(changedFiles, sharedChangedFilesEnv) {
  if (!shouldRunFigmaPipelineGuard(changedFiles)) {
    return;
  }
  await runCommandAsync(
    "node",
    ["scripts/figma-pipeline/validate-artifacts.mjs", "--allow-missing-artifacts"],
    "Figma pipeline artifact/schema guard",
    {
      env: sharedChangedFilesEnv,
    }
  );
}

async function runWorkflowGovernanceGuard(changedFiles) {
  if (forceFull) {
    return;
  }
  if (!shouldRunWorkflowGovernanceGuard(changedFiles)) {
    return;
  }
  await runCommandAsync("pnpm", ["check:workflow-governance"], "Workflow governance guard");
}

async function main() {
  const changedFiles = collectChangedFiles();
  if (changedFiles.length === 0 && !forceFull) {
    return;
  }

  if (changedFiles.length === 0 && forceFull) {
  }

  const validationCache = loadValidationCache();
  const { mode, reason, highImpactFiles, highImpactHashes } = resolveValidationMode(
    changedFiles,
    validationCache
  );
  const skipStyleLintDuplicateGuards = mode === "full";
  const skipFrontendWideFullDuplicateGuards =
    mode === "full" && shouldRunFrontendWideFullGateChecks(changedFiles);
  printChangedFiles(changedFiles);

  if (mode === "docs-only") {
    return;
  }
  if (mode === "blocked-targeted") {
    throw new Error(
      `${reason}. Run \`pnpm validate\` or pass \`--allow-risky-targeted\` only when you intentionally accept reduced coverage.`
    );
  }

  assertWindowsRustToolchainPrereqs();

  const sharedChangedFilesEnv = buildSharedChangedFilesEnv(changedFiles);
  await Promise.all([
    runWorkflowGovernanceGuard(changedFiles),
    runLlmScaffoldingGuard(changedFiles, sharedChangedFilesEnv),
    runChangedTestPlaceholderGuard(changedFiles, sharedChangedFilesEnv),
    runRustFileSizeGuard(changedFiles, sharedChangedFilesEnv),
    runRuntimeLayeringGuard(changedFiles, sharedChangedFilesEnv),
    runRuntimePortExportGuard(changedFiles, sharedChangedFilesEnv),
    runNativeRuntimeParityGuard(changedFiles, sharedChangedFilesEnv),
    runNoWildcardExportGuard(changedFiles, sharedChangedFilesEnv),
    runRuntimeSotGuard(changedFiles, sharedChangedFilesEnv),
    runDesignRuntimeSotGuard(changedFiles, sharedChangedFilesEnv),
    runFeatureStyleIslandsGuard(changedFiles, sharedChangedFilesEnv),
    runDesignSystemOwnershipGuard(changedFiles, sharedChangedFilesEnv),
    runDesignSystemBaseline(changedFiles, sharedChangedFilesEnv),
    ...(skipFrontendWideFullDuplicateGuards
      ? []
      : [runFrontendFileSizeGuard(changedFiles, sharedChangedFilesEnv)]),
    runStyleColorTokenGuard(changedFiles, sharedChangedFilesEnv),
    ...(skipStyleLintDuplicateGuards
      ? []
      : [
          runStyleColorSotGuard(changedFiles, sharedChangedFilesEnv),
          runStyleSemanticPrimitiveGuard(changedFiles, sharedChangedFilesEnv),
        ]),
    runThemeTokenParityGuard(changedFiles, sharedChangedFilesEnv),
    runLegacyStyleClassGuard(changedFiles, sharedChangedFilesEnv),
    runStyleModuleFilenameGuard(changedFiles, sharedChangedFilesEnv),
    runButtonSemanticsGuard(changedFiles, sharedChangedFilesEnv),
    ...(skipStyleLintDuplicateGuards
      ? []
      : [
          runInlineStyleGuard(changedFiles, sharedChangedFilesEnv),
          runStyleStackGuard(changedFiles, sharedChangedFilesEnv),
        ]),
    runUiServiceBoundaryGuard(changedFiles, sharedChangedFilesEnv),
    ...(skipFrontendWideFullDuplicateGuards
      ? []
      : [
          runDuplicateGlobalSelectorGuard(changedFiles, sharedChangedFilesEnv),
          runStaleStyleSelectorGuard(changedFiles, sharedChangedFilesEnv),
        ]),
    runStyleBudgetGuard(changedFiles, sharedChangedFilesEnv),
    ...(skipFrontendWideFullDuplicateGuards
      ? []
      : [runGlobalStyleBoundaryGuard(changedFiles, sharedChangedFilesEnv)]),
    runStyleBridgeGuard(changedFiles, sharedChangedFilesEnv),
    runFigmaPipelineGuard(changedFiles, sharedChangedFilesEnv),
  ]);
  await runFrontendOptimizationGuard(changedFiles);
  runLegacyIdentifierGuard(changedFiles);

  if (mode === "full") {
    await runFullGate(reason, changedFiles, validationCache);
    if (highImpactFiles.length > 0) {
      updateFullGateSnapshot(highImpactFiles, highImpactHashes);
    }
    return;
  }

  if (reason !== "targeted checks applicable") {
  }
  await runTargetedChecks(changedFiles, validationCache);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
}
