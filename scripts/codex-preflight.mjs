#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadE2EMapConfig } from "./lib/e2e-map.mjs";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";
import { evaluateBranchPolicy } from "./lib/branch-policy.mjs";

const PROJECT_DOC_MAX_BYTES = 32_768;
const RECOMMENDED_AGENTS_MAX_LINES = 300;
const MAX_AGENTS_LINE_HARD_LIMIT = 400;
const RECOMMENDED_MODEL = "gpt-5.4";
const API_FALLBACK_MODEL = "gpt-5.2-codex";
const MIN_CODEX_CLI_VERSION = "0.98.0";
const RECOMMENDED_REASONING_EFFORT = new Set(["high", "xhigh"]);
const RECOMMENDED_VERBOSITY = new Set(["low", "medium"]);
const RECOMMENDED_APPROVAL_POLICY = "never";
const RECOMMENDED_SANDBOX_MODE = "danger-full-access";
const RECOMMENDED_WEB_SEARCH_MODE = "live";
const ALLOWED_WEB_SEARCH_MODES = new Set(["live", "cached", "disabled"]);
const CODE_RUNTIME_LOCAL_EXEC_ENV = "CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC";
const DEV_RUNTIME_BOOTSTRAP_SCRIPT = "scripts/dev-code-runtime-gateway-web-all.mjs";

/**
 * @typedef {"PASS" | "WARN" | "FAIL"} CheckStatus
 */

/** @typedef {{status: CheckStatus; name: string; detail: string}} CheckResult */

/** @type {CheckResult[]} */
const checks = [];
const json = process.argv.includes("--json");

function readFileText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function pushCheck(status, name, detail) {
  checks.push({ status, name, detail });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function stripInlineComment(line) {
  return line.split("#")[0]?.trim() ?? "";
}

function parseSectionHeader(candidate) {
  const sectionMatch = candidate.match(/^\[([^\]]+)\]$/u);
  if (!sectionMatch?.[1]) {
    return null;
  }
  const sectionName = sectionMatch[1].trim();
  return sectionName.length > 0 ? sectionName : null;
}

function parseKeyValue(candidate) {
  const keyValueMatch = candidate.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/u);
  if (!keyValueMatch?.[1]) {
    return null;
  }
  return {
    key: keyValueMatch[1],
    rawValue: keyValueMatch[2]?.trim() ?? "",
  };
}

function setConfigValue(topLevel, sections, currentSection, key, rawValue) {
  if (!currentSection) {
    topLevel[key] = rawValue;
    return;
  }
  const sectionValues = sections[currentSection] ?? {};
  sectionValues[key] = rawValue;
  sections[currentSection] = sectionValues;
}

function createCodexConfigIndex(configText) {
  const lines = configText.split(/\r?\n/u);
  /** @type {Record<string, string>} */
  const topLevel = {};
  /** @type {Record<string, Record<string, string>>} */
  const sections = {};
  let currentSection = null;

  for (const line of lines) {
    const candidate = stripInlineComment(line.trim());
    if (candidate.length === 0) {
      continue;
    }

    const sectionName = parseSectionHeader(candidate);
    if (sectionName) {
      currentSection = sectionName;
      sections[currentSection] = sections[currentSection] ?? {};
      continue;
    }

    const parsedValue = parseKeyValue(candidate);
    if (!parsedValue) {
      continue;
    }

    setConfigValue(topLevel, sections, currentSection, parsedValue.key, parsedValue.rawValue);
  }

  return { topLevel, sections };
}

function parseRawTypedValue(rawValue, type) {
  if (typeof rawValue !== "string") {
    return null;
  }

  if (type === "string") {
    const valueMatch = rawValue.match(/^"([^"]+)"$/u);
    return valueMatch?.[1] ?? null;
  }

  if (type === "number") {
    const valueMatch = rawValue.match(/^(\d+)$/u);
    return valueMatch?.[1] ? Number(valueMatch[1]) : null;
  }

  if (type === "boolean") {
    if (rawValue === "true") {
      return true;
    }
    if (rawValue === "false") {
      return false;
    }
  }

  return null;
}

function parseTopLevelValue(configIndex, key, type) {
  return parseRawTypedValue(configIndex.topLevel[key], type);
}

function parseSectionValue(configIndex, sectionName, key, type) {
  const sectionValues = configIndex.sections[sectionName];
  if (!sectionValues) {
    return null;
  }
  return parseRawTypedValue(sectionValues[key], type);
}

function parseRootModel(configIndex) {
  return parseTopLevelValue(configIndex, "model", "string");
}

function parseProfileModel(configIndex, profileName) {
  return parseSectionValue(configIndex, `profiles.${profileName}`, "model", "string");
}

function parseSemver(input) {
  const match = input.match(/(\d+)\.(\d+)\.(\d+)/u);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left, right) {
  for (let idx = 0; idx < Math.min(left.length, right.length); idx += 1) {
    if (left[idx] > right[idx]) {
      return 1;
    }
    if (left[idx] < right[idx]) {
      return -1;
    }
  }
  return 0;
}

function checkExactConfigValue({ name, actual, expected, missingDetail, mismatchDetail }) {
  if (!actual) {
    pushCheck("WARN", name, missingDetail);
    return;
  }

  if (actual === expected) {
    pushCheck("PASS", name, `${name.toLowerCase()} is ${expected}.`);
    return;
  }

  pushCheck("WARN", name, mismatchDetail(actual));
}

function checkAllowedConfigValue({ name, actual, allowed, missingDetail, mismatchDetail }) {
  if (!actual) {
    pushCheck("WARN", name, missingDetail);
    return;
  }

  if (allowed.has(actual)) {
    pushCheck("PASS", name, `${name.toLowerCase()} is ${actual}.`);
    return;
  }

  pushCheck("WARN", name, mismatchDetail(actual));
}

function checkRootModel(configIndex) {
  const rootModel = parseRootModel(configIndex);
  if (!rootModel) {
    pushCheck("FAIL", "Root model", 'No root `model = "..."` found in .codex/config.toml.');
    return;
  }

  if (rootModel === RECOMMENDED_MODEL) {
    pushCheck("PASS", "Root model", `Root model is ${RECOMMENDED_MODEL}.`);
    return;
  }

  pushCheck(
    "WARN",
    "Root model",
    `Root model is ${rootModel}; recommended model is ${RECOMMENDED_MODEL}.`
  );
}

function checkApiFallbackModel(configIndex) {
  const fallbackModel = parseProfileModel(configIndex, "api_key_fallback");
  if (!fallbackModel) {
    pushCheck(
      "WARN",
      "API fallback profile",
      "Missing [profiles.api_key_fallback] with a model for API-key rollout fallback."
    );
    return;
  }

  if (fallbackModel === API_FALLBACK_MODEL) {
    pushCheck(
      "PASS",
      "API fallback profile",
      `api_key_fallback profile uses ${API_FALLBACK_MODEL}.`
    );
    return;
  }

  pushCheck(
    "WARN",
    "API fallback profile",
    `api_key_fallback uses ${fallbackModel}; recommended fallback is ${API_FALLBACK_MODEL}.`
  );
}

function checkReasoningEffort(configIndex) {
  checkAllowedConfigValue({
    name: "Reasoning effort",
    actual: parseTopLevelValue(configIndex, "model_reasoning_effort", "string"),
    allowed: RECOMMENDED_REASONING_EFFORT,
    missingDetail:
      "Missing `model_reasoning_effort`; recommended `high` (or `xhigh` for heavy tasks).",
    mismatchDetail: (actual) => `model_reasoning_effort is ${actual}; recommended high/xhigh.`,
  });
}

function checkVerbosity(configIndex) {
  checkAllowedConfigValue({
    name: "Verbosity",
    actual: parseTopLevelValue(configIndex, "model_verbosity", "string"),
    allowed: RECOMMENDED_VERBOSITY,
    missingDetail: "Missing `model_verbosity`; recommended `low` or `medium`.",
    mismatchDetail: (actual) => `model_verbosity is ${actual}; recommended low/medium.`,
  });
}

function checkApprovalPolicy(configIndex) {
  checkExactConfigValue({
    name: "Approval policy",
    actual: parseTopLevelValue(configIndex, "approval_policy", "string"),
    expected: RECOMMENDED_APPROVAL_POLICY,
    missingDetail: "Missing `approval_policy`; recommended `never`.",
    mismatchDetail: (actual) =>
      `approval_policy is ${actual}; recommended ${RECOMMENDED_APPROVAL_POLICY}.`,
  });
}

function checkSandboxMode(configIndex) {
  checkExactConfigValue({
    name: "Sandbox mode",
    actual: parseTopLevelValue(configIndex, "sandbox_mode", "string"),
    expected: RECOMMENDED_SANDBOX_MODE,
    missingDetail: "Missing `sandbox_mode`; recommended `danger-full-access`.",
    mismatchDetail: (actual) =>
      `sandbox_mode is ${actual}; recommended ${RECOMMENDED_SANDBOX_MODE}.`,
  });
}

function checkProjectDocBudget(configIndex) {
  const docBudget = parseTopLevelValue(configIndex, "project_doc_max_bytes", "number");
  if (docBudget === null) {
    pushCheck(
      "WARN",
      "Project doc budget",
      `Missing project_doc_max_bytes; recommended ${PROJECT_DOC_MAX_BYTES}.`
    );
    return;
  }

  if (docBudget <= PROJECT_DOC_MAX_BYTES) {
    pushCheck(
      "PASS",
      "Project doc budget",
      `project_doc_max_bytes is ${docBudget} (<= ${PROJECT_DOC_MAX_BYTES}).`
    );
    return;
  }

  pushCheck(
    "WARN",
    "Project doc budget",
    `project_doc_max_bytes is ${docBudget}; recommended <= ${PROJECT_DOC_MAX_BYTES}.`
  );
}

function checkWebSearchMode(configIndex) {
  const webSearchMode = parseTopLevelValue(configIndex, "web_search", "string");
  if (!webSearchMode) {
    pushCheck(
      "WARN",
      "Web search mode",
      `Missing top-level web_search mode; recommended "${RECOMMENDED_WEB_SEARCH_MODE}".`
    );
    return;
  }

  if (!ALLOWED_WEB_SEARCH_MODES.has(webSearchMode)) {
    pushCheck(
      "WARN",
      "Web search mode",
      `web_search is "${webSearchMode}"; supported values are live/cached/disabled.`
    );
    return;
  }

  if (webSearchMode === "disabled") {
    pushCheck(
      "WARN",
      "Web search mode",
      'web_search is "disabled"; online analysis and fresh docs lookups are disabled.'
    );
    return;
  }

  if (webSearchMode === RECOMMENDED_WEB_SEARCH_MODE) {
    pushCheck("PASS", "Web search mode", `web_search is "${RECOMMENDED_WEB_SEARCH_MODE}".`);
    return;
  }

  pushCheck(
    "PASS",
    "Web search mode",
    `web_search is "${webSearchMode}" (supported, but "${RECOMMENDED_WEB_SEARCH_MODE}" is better for freshest research).`
  );
}

function checkWebSearchRequestFlag(configIndex) {
  const requestEnabled = parseSectionValue(
    configIndex,
    "features",
    "web_search_request",
    "boolean"
  );
  if (requestEnabled === true) {
    pushCheck("PASS", "Web search requests", "features.web_search_request is true.");
    return;
  }

  if (requestEnabled === false) {
    pushCheck(
      "WARN",
      "Web search requests",
      "features.web_search_request is false; explicit web search requests are blocked."
    );
    return;
  }

  const legacyWebSearch = parseSectionValue(configIndex, "features", "web_search", "boolean");
  if (legacyWebSearch === true) {
    pushCheck(
      "WARN",
      "Web search requests",
      "Using legacy features.web_search=true but features.web_search_request is missing."
    );
    return;
  }

  if (legacyWebSearch === false) {
    pushCheck(
      "WARN",
      "Web search requests",
      "Using legacy features.web_search=false and features.web_search_request is missing."
    );
    return;
  }

  pushCheck(
    "WARN",
    "Web search requests",
    "Missing features.web_search_request; recommended true for Codex online research."
  );
}

function checkLegacyWebSearchFeature(configIndex) {
  const legacyWebSearch = parseSectionValue(configIndex, "features", "web_search", "boolean");
  if (legacyWebSearch === true) {
    pushCheck("PASS", "Legacy web_search flag", "features.web_search is true (compat mode).");
    return;
  }

  if (legacyWebSearch === false) {
    pushCheck(
      "WARN",
      "Legacy web_search flag",
      "features.web_search is false; older Codex setups may not be able to web search."
    );
    return;
  }

  pushCheck("PASS", "Legacy web_search flag", "features.web_search is not set (modern config).");
}

function isEnabledEnvFlag(rawValue) {
  if (typeof rawValue !== "string") {
    return false;
  }
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function detectLocalCodexExecDefaultDisabled(repoRoot) {
  const scriptPath = path.join(repoRoot, DEV_RUNTIME_BOOTSTRAP_SCRIPT);
  if (!fileExists(scriptPath)) {
    return null;
  }
  const scriptText = readFileText(scriptPath);
  if (scriptText.includes('CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC ?? "0"')) {
    return true;
  }
  if (scriptText.includes('CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC ?? "1"')) {
    return false;
  }
  return null;
}

function resolveLocalCodexCliRequirement(repoRoot) {
  if (isEnabledEnvFlag(process.env[CODE_RUNTIME_LOCAL_EXEC_ENV])) {
    return {
      required: true,
      reason: `${CODE_RUNTIME_LOCAL_EXEC_ENV} is enabled in current shell.`,
    };
  }

  const defaultDisabled = detectLocalCodexExecDefaultDisabled(repoRoot);
  if (defaultDisabled === true) {
    return {
      required: false,
      reason:
        "Dev runtime defaults to remote provider mode (local codex exec disabled by default).",
    };
  }
  if (defaultDisabled === false) {
    return {
      required: true,
      reason: "Dev runtime appears to default to local codex exec.",
    };
  }

  return {
    required: false,
    reason:
      "Could not determine local codex exec default from dev bootstrap script; treating local CLI as optional.",
  };
}

function checkCodexCliVersion(repoRoot) {
  const minVersionParsed = parseSemver(MIN_CODEX_CLI_VERSION);
  if (!minVersionParsed) {
    pushCheck("WARN", "Codex CLI version", "Invalid minimum Codex version guard.");
    return;
  }

  try {
    const output = execFileSync("codex", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const parsed = parseSemver(output);
    if (!parsed) {
      pushCheck(
        "WARN",
        "Codex CLI version",
        `Could not parse \`codex --version\` output: "${output}".`
      );
      return;
    }

    if (compareSemver(parsed, minVersionParsed) >= 0) {
      pushCheck(
        "PASS",
        "Codex CLI version",
        `Codex CLI version ${parsed.join(".")} (>= ${MIN_CODEX_CLI_VERSION}).`
      );
      return;
    }

    pushCheck(
      "WARN",
      "Codex CLI version",
      `Codex CLI version ${parsed.join(".")} is older than ${MIN_CODEX_CLI_VERSION}; GPT-5.3 features may be unavailable.`
    );
  } catch {
    const requirement = resolveLocalCodexCliRequirement(repoRoot);
    if (requirement.required) {
      pushCheck(
        "WARN",
        "Codex CLI version",
        `Codex CLI is not available on PATH while local codex exec is enabled/required. ${requirement.reason}`
      );
      return;
    }
    pushCheck(
      "PASS",
      "Codex CLI version",
      `Codex CLI is not available on PATH; acceptable for remote-provider mode. ${requirement.reason}`
    );
  }
}

function resolveCodexHome() {
  const override = process.env.CODEX_HOME;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  const home = os.homedir();
  return path.join(home, ".codex");
}

function parseAuthJson(authText) {
  try {
    return JSON.parse(authText);
  } catch {
    return null;
  }
}

function normalizeEnvToken(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function checkMissingAuthFallback(authPath, envApiKey) {
  if (envApiKey) {
    pushCheck(
      "PASS",
      "Codex auth detection",
      "OPENAI_API_KEY is set (API-key auth path); auth.json is not required."
    );
    return true;
  }

  pushCheck(
    "WARN",
    "Codex auth detection",
    `No auth found at ${authPath}. Run \`codex login\` for OAuth or set OPENAI_API_KEY.`
  );
  return true;
}

function resolveAuthMethod(auth, envApiKey) {
  const tokens = auth.tokens && typeof auth.tokens === "object" ? auth.tokens : {};
  const accessToken = normalizeEnvToken(tokens.access_token);
  const refreshToken = normalizeEnvToken(tokens.refresh_token);
  const authApiKey = normalizeEnvToken(auth.OPENAI_API_KEY);
  const method =
    accessToken || refreshToken ? "oauth" : authApiKey || envApiKey ? "api-key" : "none";
  return { method, authApiKey };
}

function verifyCodexAuth() {
  const codexHome = resolveCodexHome();
  const authPath = path.join(codexHome, "auth.json");
  const envApiKey = normalizeEnvToken(process.env.OPENAI_API_KEY);

  if (!fileExists(authPath)) {
    checkMissingAuthFallback(authPath, envApiKey);
    return;
  }

  const authText = readFileText(authPath);
  const auth = parseAuthJson(authText);
  if (!auth || typeof auth !== "object") {
    pushCheck("WARN", "Codex auth detection", `Invalid JSON in ${authPath}.`);
    return;
  }

  const { method, authApiKey } = resolveAuthMethod(auth, envApiKey);

  if (method === "oauth") {
    pushCheck("PASS", "Codex auth detection", `OAuth credentials detected in ${authPath}.`);
    return;
  }

  if (method === "api-key") {
    pushCheck(
      "PASS",
      "Codex auth detection",
      `API-key credentials detected (${authApiKey ? "auth.json" : "environment"}).`
    );
    return;
  }

  pushCheck(
    "WARN",
    "Codex auth detection",
    `auth.json exists at ${authPath}, but no usable OAuth/API key credentials were found.`
  );
}

function hasSessionFile(rootPath) {
  if (!fileExists(rootPath)) {
    return false;
  }

  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        return true;
      }
    }
  }

  return false;
}

function verifyCodexSessionReuse() {
  const codexHome = resolveCodexHome();
  const sessionsPath = path.join(codexHome, "sessions");
  if (!fileExists(sessionsPath)) {
    pushCheck(
      "WARN",
      "Codex session reuse",
      `No local session store at ${sessionsPath}. Run Codex once before using resume workflows.`
    );
    return;
  }

  if (hasSessionFile(sessionsPath)) {
    pushCheck(
      "PASS",
      "Codex session reuse",
      `Local Codex sessions detected at ${sessionsPath}; \`codex exec resume --last\` is available.`
    );
    return;
  }

  pushCheck(
    "WARN",
    "Codex session reuse",
    `Session directory exists at ${sessionsPath}, but no session files were found yet.`
  );
}

function verifyAgents(repoRoot) {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  if (!fileExists(agentsPath)) {
    pushCheck("FAIL", "AGENTS.md", "Missing AGENTS.md at repository root.");
    return;
  }

  const text = readFileText(agentsPath);
  const lines = text.split(/\r?\n/u).length;
  const bytes = Buffer.byteLength(text, "utf8");

  if (lines <= RECOMMENDED_AGENTS_MAX_LINES) {
    pushCheck(
      "PASS",
      "AGENTS line budget",
      `AGENTS.md has ${lines} lines (<= ${RECOMMENDED_AGENTS_MAX_LINES}).`
    );
  } else if (lines <= MAX_AGENTS_LINE_HARD_LIMIT) {
    pushCheck(
      "WARN",
      "AGENTS line budget",
      `AGENTS.md has ${lines} lines (> ${RECOMMENDED_AGENTS_MAX_LINES}); recommended to trim, hard limit is ${MAX_AGENTS_LINE_HARD_LIMIT}.`
    );
  } else {
    pushCheck(
      "FAIL",
      "AGENTS line budget",
      `AGENTS.md has ${lines} lines (> ${MAX_AGENTS_LINE_HARD_LIMIT}).`
    );
  }

  if (bytes <= PROJECT_DOC_MAX_BYTES) {
    pushCheck(
      "PASS",
      "AGENTS byte budget",
      `AGENTS.md is ${bytes} bytes (<= ${PROJECT_DOC_MAX_BYTES}).`
    );
  } else {
    pushCheck(
      "WARN",
      "AGENTS byte budget",
      `AGENTS.md is ${bytes} bytes; Codex may truncate it at ${PROJECT_DOC_MAX_BYTES} bytes.`
    );
  }

  if (text.includes("implementation_plan.md")) {
    pushCheck("PASS", "Plan reference", "AGENTS.md references implementation_plan.md.");
  } else {
    pushCheck(
      "WARN",
      "Plan reference",
      "AGENTS.md does not reference implementation_plan.md; planning handoff may be less explicit."
    );
  }
}

function verifyCodexConfig(repoRoot) {
  const configPath = path.join(repoRoot, ".codex", "config.toml");
  if (!fileExists(configPath)) {
    pushCheck(
      "PASS",
      ".codex/config.toml",
      "Project Codex config is optional/missing (using defaults)."
    );
    return;
  }

  pushCheck("PASS", ".codex/config.toml", "Project Codex config is present.");

  const configText = readFileText(configPath);
  const configIndex = createCodexConfigIndex(configText);
  checkRootModel(configIndex);
  checkApiFallbackModel(configIndex);
  checkReasoningEffort(configIndex);
  checkVerbosity(configIndex);
  checkApprovalPolicy(configIndex);
  checkSandboxMode(configIndex);
  checkProjectDocBudget(configIndex);
  checkWebSearchMode(configIndex);
  checkWebSearchRequestFlag(configIndex);
  checkLegacyWebSearchFeature(configIndex);
}

function readE2EMapConfigRaw(repoRoot) {
  const mapPath = path.join(repoRoot, ".codex", "e2e-map.json");
  if (!fileExists(mapPath)) {
    pushCheck(
      "WARN",
      "E2E map config",
      "Missing .codex/e2e-map.json; validate uses built-in E2E category defaults."
    );
    return null;
  }

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(readFileText(mapPath));
  } catch {
    pushCheck("WARN", "E2E map config", "Invalid JSON in .codex/e2e-map.json.");
    return null;
  }

  if (!parsedConfig || typeof parsedConfig !== "object") {
    pushCheck("WARN", "E2E map config", ".codex/e2e-map.json must be a JSON object.");
    return null;
  }

  return parsedConfig;
}

function verifyE2EMapConfig(repoRoot) {
  const parsedConfig = readE2EMapConfigRaw(repoRoot);
  if (!parsedConfig) {
    return;
  }

  const normalizedConfig = loadE2EMapConfig({ repoRoot });
  const categories = normalizedConfig.categories;
  if (categories.length === 0) {
    pushCheck("WARN", "E2E map config", ".codex/e2e-map.json categories[] must include values.");
    return;
  }

  const validRules = normalizedConfig.rules.length;
  if (validRules <= 0) {
    pushCheck(
      "WARN",
      "E2E map config",
      ".codex/e2e-map.json has no valid rules (category + matcher arrays)."
    );
    return;
  }

  const fallbackCodeRaw =
    typeof parsedConfig?.fallback?.codeSrcCategory === "string"
      ? parsedConfig.fallback.codeSrcCategory
      : "";
  const fallbackCategory = fallbackCodeRaw.trim().toLowerCase();

  if (fallbackCategory.length > 0 && !categories.includes(fallbackCategory)) {
    pushCheck(
      "WARN",
      "E2E map fallback",
      `fallback.codeSrcCategory is "${fallbackCategory}" but not listed in categories[].`
    );
  } else {
    pushCheck(
      "PASS",
      "E2E map config",
      `.codex/e2e-map.json is valid (${categories.length} categories, ${validRules} rules).`
    );
  }
}

function verifyPackageScripts(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fileExists(packageJsonPath)) {
    pushCheck("FAIL", "package.json", "Missing package.json.");
    return;
  }

  /** @type {{scripts?: Record<string, string>}} */
  const pkg = JSON.parse(readFileText(packageJsonPath));
  const scripts = pkg.scripts ?? {};
  const requiredScripts = [
    "lint:fix",
    "repo:doctor",
    "typecheck",
    "test:unit",
    "test:e2e:core",
    "test:e2e:blocks",
    "test:e2e:collab",
    "test:e2e:annotations",
    "test:e2e:features",
    "test:e2e:smoke",
    "test:e2e:a11y",
    "preflight:codex",
    "preflight:codex:ci",
    "check:runtime-contract",
    "check:runtime-contract:parity",
    "check:branch-policy",
    "validate",
    "validate:fast",
    "validate:fast:e2e",
    "validate:full",
    "collab:status",
    "collab:sync",
    "collab:sync:fast",
    "collab:sync:full",
  ];
  const missing = requiredScripts.filter((name) => typeof scripts[name] !== "string");

  if (missing.length === 0) {
    pushCheck("PASS", "Command loop scripts", "Required loop scripts are present in package.json.");
  } else {
    pushCheck("FAIL", "Command loop scripts", `Missing required scripts: ${missing.join(", ")}.`);
  }

  const collabSyncScript = scripts["collab:sync"];
  if (typeof collabSyncScript === "string") {
    if (collabSyncScript.includes("scripts/collab-sync-loop.mjs")) {
      pushCheck(
        "PASS",
        "Collab sync command",
        "collab:sync script targets scripts/collab-sync-loop.mjs."
      );
    } else {
      pushCheck(
        "WARN",
        "Collab sync command",
        `collab:sync is "${collabSyncScript}", expected node scripts/collab-sync-loop.mjs.`
      );
    }
  }

  const collabSyncPath = path.join(repoRoot, "scripts", "collab-sync-loop.mjs");
  if (fileExists(collabSyncPath)) {
    pushCheck("PASS", "Collab sync script", "scripts/collab-sync-loop.mjs exists.");
  } else {
    pushCheck("FAIL", "Collab sync script", "Missing scripts/collab-sync-loop.mjs.");
  }

  const branchPolicyScript = scripts["check:branch-policy"];
  if (typeof branchPolicyScript === "string") {
    if (branchPolicyScript.includes("scripts/check-branch-policy.mjs")) {
      pushCheck(
        "PASS",
        "Branch policy command",
        "check:branch-policy script targets scripts/check-branch-policy.mjs."
      );
    } else {
      pushCheck(
        "WARN",
        "Branch policy command",
        `check:branch-policy is "${branchPolicyScript}", expected node scripts/check-branch-policy.mjs.`
      );
    }
  }

  const collabStatusScript = scripts["collab:status"];
  if (typeof collabStatusScript === "string") {
    if (collabStatusScript.includes("scripts/collab-sync-loop.mjs --status-only --json")) {
      pushCheck(
        "PASS",
        "Collab status command",
        "collab:status script targets scripts/collab-sync-loop.mjs --status-only --json."
      );
    } else {
      pushCheck(
        "WARN",
        "Collab status command",
        `collab:status is "${collabStatusScript}", expected node scripts/collab-sync-loop.mjs --status-only --json.`
      );
    }
  }
}

function verifyBranchPolicy(repoRoot) {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const result = evaluateBranchPolicy(branch);
    if (result.status === "pass") {
      pushCheck("PASS", "Branch policy", result.detail);
    } else if (result.status === "warn") {
      pushCheck("WARN", "Branch policy", result.detail);
    } else {
      pushCheck("FAIL", "Branch policy", result.detail);
    }
  } catch {
    pushCheck(
      "WARN",
      "Branch policy",
      "Unable to determine current git branch; branch policy is advisory only."
    );
  }
}

function verifyCodexNightlyWorkflow(repoRoot) {
  const workflowPath = path.join(repoRoot, ".github", "workflows", "codex-nightly.yml");
  if (!fileExists(workflowPath)) {
    pushCheck(
      "WARN",
      "Codex nightly workflow",
      "Missing .github/workflows/codex-nightly.yml (optional but recommended)."
    );
    return;
  }

  const workflowText = readFileText(workflowPath);
  if (workflowText.includes("openai/codex-action@v1")) {
    pushCheck("PASS", "Codex nightly workflow", "Nightly workflow uses openai/codex-action@v1.");
  } else {
    pushCheck(
      "WARN",
      "Codex nightly workflow",
      "Nightly workflow does not include openai/codex-action@v1."
    );
  }

  if (workflowText.includes(".github/codex/prompts/nightly-infra.md")) {
    pushCheck(
      "PASS",
      "Codex nightly prompt",
      "Nightly workflow references .github/codex/prompts/nightly-infra.md."
    );
  } else {
    pushCheck(
      "WARN",
      "Codex nightly prompt",
      "Nightly workflow does not reference the standard nightly prompt file."
    );
  }
}

function verifyCiGate(repoRoot) {
  const ciPath = path.join(repoRoot, ".github", "workflows", "ci.yml");
  const qualityWorkflowPath = path.join(
    repoRoot,
    ".github",
    "workflows",
    "_reusable-ci-quality.yml"
  );
  if (!fileExists(ciPath)) {
    pushCheck("WARN", "CI preflight gate", "CI workflow not found; skipped Codex gate check.");
    return;
  }

  const ciText = readFileText(ciPath);
  const qualityWorkflowText = fileExists(qualityWorkflowPath)
    ? readFileText(qualityWorkflowPath)
    : "";
  if (
    ciText.includes("pnpm preflight:codex") ||
    ciText.includes("pnpm preflight:codex:ci") ||
    qualityWorkflowText.includes("pnpm preflight:codex") ||
    qualityWorkflowText.includes("pnpm preflight:codex:ci")
  ) {
    pushCheck(
      "PASS",
      "CI preflight gate",
      "CI includes a Codex preflight gate (`preflight:codex` or `preflight:codex:ci`)."
    );
  } else {
    pushCheck(
      "WARN",
      "CI preflight gate",
      "CI does not run a Codex preflight gate; Codex readiness can regress silently."
    );
  }
}

function renderResults() {
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  const warnCount = checks.filter((check) => check.status === "WARN").length;
  const passCount = checks.filter((check) => check.status === "PASS").length;

  if (json) {
    writeCheckJson({
      check: "codex-preflight",
      ok: failCount === 0,
      errors: checks
        .filter((check) => check.status === "FAIL")
        .map((check) => `${check.name}: ${check.detail}`),
      warnings: checks
        .filter((check) => check.status === "WARN")
        .map((check) => `${check.name}: ${check.detail}`),
      details: {
        summary: {
          passCount,
          warnCount,
          failCount,
        },
        checks,
      },
    });
    return failCount;
  }

  writeLines(
    process.stdout,
    checks.map((check) => renderCheckMessage(check.status, `${check.name}: ${check.detail}`))
  );
  writeLines(process.stdout, [
    renderCheckMessage(
      failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS",
      `Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail.`
    ),
  ]);

  return failCount;
}

function main() {
  const repoRoot = process.cwd();
  checkCodexCliVersion(repoRoot);
  verifyCodexAuth();
  verifyCodexSessionReuse();
  verifyAgents(repoRoot);
  verifyCodexConfig(repoRoot);
  verifyE2EMapConfig(repoRoot);
  verifyPackageScripts(repoRoot);
  verifyBranchPolicy(repoRoot);
  verifyCodexNightlyWorkflow(repoRoot);
  verifyCiGate(repoRoot);

  const failCount = renderResults();
  process.exitCode = failCount > 0 ? 1 : 0;
}

main();
