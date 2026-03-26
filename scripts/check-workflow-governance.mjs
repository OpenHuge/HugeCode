#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, ".github", "workflows");
const actionsDir = path.join(repoRoot, ".github", "actions");
const INTERNAL_REUSABLE_WORKFLOW_PREFIX = "_reusable-";

const WORKFLOW_PERMISSION_ALLOWLIST = new Set(["codeql.yml", "release.yml"]);
const WORKFLOW_CONCURRENCY_ALLOWLIST = new Set();
const LEGACY_BRAND_PATTERNS = [
  { label: "Open Wrap", regex: /Open Wrap|OpenWrap/u },
  { label: "Keep-Up", regex: /Keep-Up/u },
];
const CI_FILTER_EXTRA_REQUIREMENTS = new Map([
  [
    "repo_sot",
    new Set([
      ".devcontainer/devcontainer.json",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/dependabot.yml",
      ".github/dependency-review-config.yml",
      "docs/development/ci-workflows.md",
      "pnpm-workspace.yaml",
      "rust-toolchain.toml",
      "scripts/check-branch-policy.mjs",
      "scripts/lib/branch-policy.mjs",
      "scripts/check-repo-sot.mjs",
      "scripts/check-workflow-governance.mjs",
      "scripts/workflow-list.mjs",
    ]),
  ],
]);
const CI_FILTER_EXCLUDED_REQUIREMENTS = new Map();
const errors = [];
const actionRequirementCache = new Map();
const workflowRequirementCache = new Map();
const globCache = new Map();
const PNPM_FLAGS_WITH_VALUE = new Set(["-C", "--dir", "--filter", "--config", "--reporter"]);
const SHELL_CONTROL_OPERATORS = new Set(["&&", "||", "|", ";"]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function countIndent(line) {
  return line.length - line.trimStart().length;
}

function readText(repoRelativePath) {
  return fs.readFileSync(path.join(repoRoot, repoRelativePath), "utf8");
}

function readLines(repoRelativePath) {
  return readText(repoRelativePath).split(/\r?\n/u);
}

function escapeRegExp(value) {
  return value.replace(/[\\^$+?.()|[\]{}]/gu, "\\$&");
}

function normalizeRepoRelativePath(filePath) {
  return toPosixPath(filePath).replace(/^\.\//u, "");
}

function tokenizeShellLine(line) {
  return line
    .trim()
    .split(/\s+/u)
    .map((token) => stripQuotes(token))
    .filter(Boolean);
}

function consumePnpmFlags(tokens, startIndex) {
  const flags = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (SHELL_CONTROL_OPERATORS.has(token)) {
      break;
    }
    if (!token.startsWith("-")) {
      break;
    }

    if (token.includes("=")) {
      const [name, value = ""] = token.split("=", 2);
      flags.push({ name, value });
      index += 1;
      continue;
    }

    if (PNPM_FLAGS_WITH_VALUE.has(token)) {
      const nextValue = tokens[index + 1];
      if (nextValue && !nextValue.startsWith("-") && !SHELL_CONTROL_OPERATORS.has(nextValue)) {
        flags.push({ name: token, value: nextValue });
        index += 2;
        continue;
      }
    }

    flags.push({ name: token, value: null });
    index += 1;
  }

  return { flags, nextIndex: index };
}

function collectInvocationArgs(tokens, startIndex) {
  const args = [];
  for (let argIndex = startIndex; argIndex < tokens.length; argIndex += 1) {
    const token = tokens[argIndex];
    if (SHELL_CONTROL_OPERATORS.has(token)) {
      break;
    }
    args.push(token);
  }
  return args;
}

function parsePnpmInvocation(tokens, tokenIndex, lineNumber, lineText) {
  const { flags, nextIndex } = consumePnpmFlags(tokens, tokenIndex + 1);
  let commandIndex = nextIndex;
  if (tokens[commandIndex] === "run") {
    commandIndex += 1;
  }

  const command = tokens[commandIndex];
  if (!command || SHELL_CONTROL_OPERATORS.has(command)) {
    return null;
  }

  return {
    line: lineNumber,
    text: lineText.trim(),
    flags,
    command,
    args: collectInvocationArgs(tokens, commandIndex + 1),
  };
}

function extractPnpmInvocations(lines) {
  const invocations = [];

  lines.forEach((line, index) => {
    if (line.trim().startsWith("#")) {
      return;
    }

    const tokens = tokenizeShellLine(line);
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      if (tokens[tokenIndex] !== "pnpm") {
        continue;
      }

      const invocation = parsePnpmInvocation(tokens, tokenIndex, index + 1, line);
      if (invocation) {
        invocations.push(invocation);
      }
    }
  });

  return invocations;
}

function collectDeprecatedScriptAliases() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return new Map();
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const scripts = packageJson.scripts ?? {};
  const aliases = new Map();

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (typeof command !== "string" || !command.includes("deprecated-script-alias.mjs")) {
      continue;
    }

    const match = command.match(
      /deprecated-script-alias\.mjs\s+(\S+)\s+(\S+)\s+--\s+pnpm\s+(\S+)/u
    );
    if (!match?.[1] || !match[2] || !match[3]) {
      continue;
    }

    const deprecatedName = match[1];
    const canonicalName = match[2] === match[3] ? match[2] : match[3];
    aliases.set(scriptName, canonicalName);
    aliases.set(deprecatedName, canonicalName);
  }

  return aliases;
}

const deprecatedScriptAliases = collectDeprecatedScriptAliases();

function globToRegExp(pattern) {
  const normalized = stripQuotes(pattern.trim());
  if (globCache.has(normalized)) {
    return globCache.get(normalized);
  }

  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === "*") {
      if (next === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }
    source += escapeRegExp(character);
  }

  const expression = new RegExp(`^${source}$`, "u");
  globCache.set(normalized, expression);
  return expression;
}

function hasPathCoverage(patterns, actualPath) {
  const normalizedPath = toPosixPath(actualPath);
  return patterns.some((pattern) => {
    const normalizedPattern = stripQuotes(pattern.trim());
    if (normalizedPattern.length === 0 || normalizedPattern.startsWith("!")) {
      return false;
    }
    return globToRegExp(normalizedPattern).test(normalizedPath);
  });
}

function listWorkflowFiles() {
  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
    .map((entry) => entry.name)
    .sort();
}

function listActionFiles(currentDir = actionsDir, prefix = ".github/actions") {
  return fs
    .readdirSync(currentDir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryDiskPath = path.join(currentDir, entry.name);
      const entryRepoPath = path.posix.join(prefix, entry.name);

      if (entry.isDirectory()) {
        return listActionFiles(entryDiskPath, entryRepoPath);
      }

      if (entry.isFile() && entry.name === "action.yml") {
        return [entryRepoPath];
      }

      return [];
    })
    .sort();
}

function isInternalReusableWorkflow(fileName) {
  return fileName.startsWith(INTERNAL_REUSABLE_WORKFLOW_PREFIX);
}

function extractLocalActionNames(text) {
  const names = new Set();
  const matches = text.matchAll(/uses:\s+\.\/\.github\/actions\/([A-Za-z0-9_-]+)/gu);
  for (const match of matches) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

function extractLocalReusableWorkflowNames(text) {
  const names = new Set();
  const matches = text.matchAll(/uses:\s+\.\/\.github\/workflows\/([A-Za-z0-9._-]+\.yml)/gu);
  for (const match of matches) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

function resolveLocalActionRequirements(actionName, stack = new Set()) {
  if (actionRequirementCache.has(actionName)) {
    return new Set(actionRequirementCache.get(actionName));
  }

  const actionRepoPath = path.posix.join(".github/actions", actionName, "action.yml");
  const actionDiskPath = path.join(actionsDir, actionName, "action.yml");
  if (!fs.existsSync(actionDiskPath)) {
    errors.push(`Local action "${actionRepoPath}" does not exist.`);
    return new Set([actionRepoPath]);
  }

  if (stack.has(actionName)) {
    return new Set([actionRepoPath]);
  }

  stack.add(actionName);
  const content = fs.readFileSync(actionDiskPath, "utf8");
  const requirements = new Set([actionRepoPath]);

  for (const scriptReference of extractScriptReferences(content)) {
    requirements.add(scriptReference);
  }

  for (const dependency of extractLocalActionNames(content)) {
    for (const requiredPath of resolveLocalActionRequirements(dependency, stack)) {
      requirements.add(requiredPath);
    }
  }

  stack.delete(actionName);
  actionRequirementCache.set(actionName, new Set(requirements));
  return new Set(requirements);
}

function resolveWorkflowRequirements(fileName, stack = new Set()) {
  if (workflowRequirementCache.has(fileName)) {
    return new Set(workflowRequirementCache.get(fileName));
  }

  const workflowRepoPath = path.posix.join(".github/workflows", fileName);
  const workflowDiskPath = path.join(workflowsDir, fileName);
  if (!fs.existsSync(workflowDiskPath)) {
    errors.push(`Local reusable workflow "${workflowRepoPath}" does not exist.`);
    return new Set([workflowRepoPath]);
  }

  if (stack.has(fileName)) {
    errors.push(`${workflowRepoPath}: recursive reusable workflow dependency detected.`);
    return new Set([workflowRepoPath]);
  }

  stack.add(fileName);
  const content = fs.readFileSync(workflowDiskPath, "utf8");
  const requirements = new Set([workflowRepoPath]);

  for (const actionPath of resolveActionRequirements(extractLocalActionNames(content))) {
    requirements.add(actionPath);
  }

  for (const scriptReference of extractScriptReferences(content)) {
    requirements.add(scriptReference);
  }

  for (const dependency of extractLocalReusableWorkflowNames(content)) {
    for (const requiredPath of resolveWorkflowRequirements(dependency, stack)) {
      requirements.add(requiredPath);
    }
  }

  stack.delete(fileName);
  workflowRequirementCache.set(fileName, new Set(requirements));
  return new Set(requirements);
}

function shouldEnterOnBlock(indent, trimmed) {
  return indent === 0 && trimmed === "on:";
}

function isTopLevelBoundary(indent, trimmed) {
  return indent === 0 && trimmed.length > 0;
}

function consumeCollectedPathLine(scopes, state, trimmed, indent) {
  if (!state.collectingPaths) {
    return false;
  }

  if (trimmed.length === 0) {
    return true;
  }

  if (indent > state.pathsIndent && trimmed.startsWith("- ")) {
    scopes.get(state.currentEvent)?.push(stripQuotes(trimmed.slice(2).trim()));
    return true;
  }

  if (indent <= state.pathsIndent) {
    state.collectingPaths = false;
  }

  return false;
}

function updatePathScopeEvent(scopes, state, trimmed, indent) {
  if (indent === 2 && /^(push|pull_request):/u.test(trimmed)) {
    state.currentEvent = trimmed.slice(0, trimmed.indexOf(":"));
    scopes.set(state.currentEvent, []);
    return;
  }

  if (indent === 2 && trimmed.endsWith(":")) {
    state.currentEvent = null;
    return;
  }

  if (state.currentEvent && indent === 4 && trimmed === "paths:") {
    state.collectingPaths = true;
    state.pathsIndent = indent;
  }
}

function parseWorkflowPathScopes(lines) {
  const scopes = new Map();
  const state = {
    inOnBlock: false,
    currentEvent: null,
    collectingPaths: false,
    pathsIndent: -1,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (!state.inOnBlock) {
      if (shouldEnterOnBlock(indent, trimmed)) {
        state.inOnBlock = true;
      }
      continue;
    }

    if (isTopLevelBoundary(indent, trimmed)) {
      break;
    }

    if (consumeCollectedPathLine(scopes, state, trimmed, indent)) {
      continue;
    }

    updatePathScopeEvent(scopes, state, trimmed, indent);
  }

  return scopes;
}

function parseInlineOnKeys(inlineValue) {
  const keys = new Set();
  if (inlineValue.startsWith("[") && inlineValue.endsWith("]")) {
    for (const key of inlineValue.slice(1, -1).split(",")) {
      const normalized = stripQuotes(key.trim());
      if (normalized.length > 0) {
        keys.add(normalized);
      }
    }
    return keys;
  }

  keys.add(stripQuotes(inlineValue));
  return keys;
}

function extractOnKeysFromTopLevelLine(indent, trimmed) {
  if (indent !== 0 || !trimmed.startsWith("on:")) {
    return null;
  }

  const inlineValue = trimmed.slice("on:".length).trim();
  if (inlineValue.length === 0) {
    return new Set();
  }

  return parseInlineOnKeys(inlineValue);
}

function collectNestedOnKey(keys, indent, trimmed) {
  if (indent === 2 && trimmed.endsWith(":")) {
    keys.add(trimmed.slice(0, -1));
  }
}

function parseOnKeys(lines) {
  const keys = new Set();
  let inOnBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (!inOnBlock) {
      const topLevelKeys = extractOnKeysFromTopLevelLine(indent, trimmed);
      if (topLevelKeys === null) {
        continue;
      }
      if (topLevelKeys.size > 0) {
        return topLevelKeys;
      }

      inOnBlock = true;
      continue;
    }

    if (indent === 0 && trimmed.length > 0) {
      break;
    }

    collectNestedOnKey(keys, indent, trimmed);
  }

  return keys;
}

function hasTopLevelKey(lines, key) {
  return lines.some((line) => countIndent(line) === 0 && line.startsWith(`${key}:`));
}

function getTopLevelBlock(lines, key) {
  const block = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (!inBlock) {
      if (indent === 0 && trimmed === `${key}:`) {
        inBlock = true;
        block.push(line);
      }
      continue;
    }

    if (indent === 0 && trimmed.length > 0) {
      break;
    }

    block.push(line);
  }

  return block;
}

function hasUnconditionalCancelInProgress(lines) {
  const concurrencyBlock = getTopLevelBlock(lines, "concurrency");
  if (concurrencyBlock.length === 0) {
    return false;
  }

  return concurrencyBlock.some((line) => {
    const trimmed = line.trim();
    return countIndent(line) === 2 && trimmed === "cancel-in-progress: true";
  });
}

function findLegacyBrandMatches(lines) {
  const matches = [];
  lines.forEach((line, index) => {
    for (const pattern of LEGACY_BRAND_PATTERNS) {
      if (pattern.regex.test(line)) {
        matches.push({ label: pattern.label, line: index + 1, text: line.trim() });
      }
    }
  });
  return matches;
}

function parseJobs(lines) {
  const jobs = new Map();
  let inJobsBlock = false;
  let currentJobId = null;
  let currentJobLines = [];

  const flush = () => {
    if (currentJobId) {
      jobs.set(currentJobId, [...currentJobLines]);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (!inJobsBlock) {
      if (indent === 0 && trimmed === "jobs:") {
        inJobsBlock = true;
      }
      continue;
    }

    if (indent === 0 && trimmed.length > 0) {
      flush();
      break;
    }

    if (indent === 2 && /^[A-Za-z0-9_-]+:\s*$/u.test(trimmed)) {
      flush();
      currentJobId = trimmed.slice(0, -1);
      currentJobLines = [];
      continue;
    }

    if (currentJobId) {
      currentJobLines.push(line);
    }
  }

  flush();
  return jobs;
}

function extractJobLevelFilterDependencies(jobLines) {
  const dependencies = new Set();

  for (const line of jobLines) {
    const trimmed = line.trim();
    if (trimmed === "steps:") {
      break;
    }
    if (trimmed.startsWith("if:")) {
      const matches = trimmed.matchAll(/needs\.changes\.outputs\.([A-Za-z0-9_]+)_changed/gu);
      for (const match of matches) {
        if (match[1]) {
          dependencies.add(match[1]);
        }
      }
    }
  }

  return dependencies;
}

function extractScriptReferences(text) {
  const references = new Set();
  const patterns = [
    /(?:^|[\s;&|()])(?:node|bash|sh|source)\s+((?:\.\/)?scripts\/[^\s"'`|&;()]+)/gmu,
    /(?:^|[\s;&|()])((?:\.\/)?scripts\/[^\s"'`|&;()]+\.(?:sh|mjs|cjs|js|ts))/gmu,
  ];

  for (const line of text.split(/\r?\n/u)) {
    if (line.trim().startsWith("#")) {
      continue;
    }

    for (const pattern of patterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          references.add(normalizeRepoRelativePath(match[1].trim()));
        }
      }
    }
  }

  return references;
}

function checkReferencedScripts(fileRepoPath, text) {
  for (const scriptReference of extractScriptReferences(text)) {
    if (!fs.existsSync(path.join(repoRoot, scriptReference))) {
      errors.push(`${fileRepoPath}: referenced script "${scriptReference}" does not exist.`);
    }
  }
}

function checkPlaywrightInstallUsage(fileRepoPath, lines) {
  for (const invocation of extractPnpmInvocations(lines)) {
    if (
      invocation.command === "exec" &&
      invocation.args[0] === "playwright" &&
      invocation.args[1] === "install"
    ) {
      const hasWorkspaceScope = invocation.flags.some(
        (flag) => flag.name === "-C" || flag.name === "--dir"
      );

      if (!hasWorkspaceScope) {
        errors.push(
          `${fileRepoPath}:${invocation.line}: Playwright install commands must use a workspace-scoped \`pnpm -C <workspace> exec playwright install ...\` command or a shared setup action (${invocation.text}).`
        );
      }
    }
  }
}

function checkDeprecatedScriptAliasUsage(fileRepoPath, lines) {
  if (deprecatedScriptAliases.size === 0) {
    return;
  }

  for (const invocation of extractPnpmInvocations(lines)) {
    const canonicalName = deprecatedScriptAliases.get(invocation.command);
    if (!canonicalName) {
      continue;
    }

    errors.push(
      `${fileRepoPath}:${invocation.line}: deprecated pnpm script alias "${invocation.command}" is not allowed; use "${canonicalName}" instead (${invocation.text}).`
    );
  }
}

function parseCiFilters(lines) {
  const filters = new Map();
  const filterLineIndex = lines.findIndex((line) => line.trim() === "filters: |");
  if (filterLineIndex === -1) {
    return filters;
  }

  const filtersIndent = countIndent(lines[filterLineIndex]);
  const blockLines = [];
  for (let index = filterLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (trimmed.length > 0 && indent <= filtersIndent) {
      break;
    }
    blockLines.push(line);
  }

  const contentLines = blockLines.filter((line) => line.trim().length > 0);
  if (contentLines.length === 0) {
    return filters;
  }

  const filterIndent = Math.min(...contentLines.map((line) => countIndent(line)));
  let currentFilter = null;

  for (const line of blockLines) {
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (trimmed.length === 0) {
      continue;
    }

    if (indent === filterIndent && trimmed.endsWith(":")) {
      currentFilter = trimmed.slice(0, -1);
      filters.set(currentFilter, []);
      continue;
    }

    if (currentFilter && indent > filterIndent && trimmed.startsWith("- ")) {
      filters.get(currentFilter)?.push(stripQuotes(trimmed.slice(2).trim()));
    }
  }

  return filters;
}

function resolveActionRequirements(actionNames) {
  const requiredPaths = new Set();
  for (const actionName of actionNames) {
    for (const requiredPath of resolveLocalActionRequirements(actionName)) {
      requiredPaths.add(requiredPath);
    }
  }
  return requiredPaths;
}

function buildPathScopedWorkflowRequiredPaths(fileName, workflowText) {
  const requiredPaths = new Set([path.posix.join(".github/workflows", fileName)]);

  for (const actionPath of resolveActionRequirements(extractLocalActionNames(workflowText))) {
    requiredPaths.add(actionPath);
  }

  for (const workflowName of extractLocalReusableWorkflowNames(workflowText)) {
    for (const requiredPath of resolveWorkflowRequirements(workflowName)) {
      requiredPaths.add(requiredPath);
    }
  }

  return requiredPaths;
}

function buildCiJobRequiredPaths(jobLines, ciWorkflowRepoPath) {
  const jobText = jobLines.join("\n");
  const requiredPaths = new Set([ciWorkflowRepoPath]);

  for (const actionPath of resolveActionRequirements(extractLocalActionNames(jobText))) {
    requiredPaths.add(actionPath);
  }

  for (const scriptReference of extractScriptReferences(jobText)) {
    requiredPaths.add(scriptReference);
  }

  for (const workflowName of extractLocalReusableWorkflowNames(jobText)) {
    for (const requiredPath of resolveWorkflowRequirements(workflowName)) {
      requiredPaths.add(requiredPath);
    }
  }

  return requiredPaths;
}

function addFilterRequirements(requirements, filterDependencies, requiredPaths) {
  for (const filterName of filterDependencies) {
    if (!requirements.has(filterName)) {
      requirements.set(filterName, new Set());
    }
    const filterRequirements = requirements.get(filterName);
    for (const requiredPath of requiredPaths) {
      filterRequirements.add(requiredPath);
    }
  }
}

function mergeExplicitCiFilterRequirements(requirements) {
  for (const [filterName, extraRequirements] of CI_FILTER_EXTRA_REQUIREMENTS) {
    if (!requirements.has(filterName)) {
      requirements.set(filterName, new Set());
    }
    const filterRequirements = requirements.get(filterName);
    for (const repoRelativePath of extraRequirements) {
      filterRequirements.add(repoRelativePath);
    }
  }
}

function collectCiFilterRequirements(ciWorkflowRepoPath) {
  const lines = readLines(ciWorkflowRepoPath);
  const jobs = parseJobs(lines);
  const requirements = new Map();

  for (const [, jobLines] of jobs.entries()) {
    const filterDependencies = extractJobLevelFilterDependencies(jobLines);
    if (filterDependencies.size === 0) {
      continue;
    }

    addFilterRequirements(
      requirements,
      filterDependencies,
      buildCiJobRequiredPaths(jobLines, ciWorkflowRepoPath)
    );
  }

  mergeExplicitCiFilterRequirements(requirements);

  return { filters: parseCiFilters(lines), requirements };
}

function checkWorkflowMetadata(fileName, lines) {
  const onKeys = parseOnKeys(lines);

  if (
    !isInternalReusableWorkflow(fileName) &&
    !WORKFLOW_PERMISSION_ALLOWLIST.has(fileName) &&
    !hasTopLevelKey(lines, "permissions")
  ) {
    errors.push(`.github/workflows/${fileName}: missing top-level permissions block.`);
  }

  if (
    !isInternalReusableWorkflow(fileName) &&
    !WORKFLOW_CONCURRENCY_ALLOWLIST.has(fileName) &&
    !hasTopLevelKey(lines, "concurrency")
  ) {
    errors.push(`.github/workflows/${fileName}: missing top-level concurrency block.`);
  }

  if (
    !isInternalReusableWorkflow(fileName) &&
    onKeys.has("merge_group") &&
    hasUnconditionalCancelInProgress(lines)
  ) {
    errors.push(
      `.github/workflows/${fileName}: workflows triggered by merge_group must not use unconditional cancel-in-progress: true; scope cancellation to pull_request events instead.`
    );
  }

  for (const match of findLegacyBrandMatches(lines)) {
    errors.push(
      `.github/workflows/${fileName}:${match.line}: legacy brand string "${match.label}" is not allowed in active workflow definitions (${match.text}).`
    );
  }
}

function checkAutomationDefinition(repoRelativePath, lines, text) {
  checkReferencedScripts(repoRelativePath, text);
  checkPlaywrightInstallUsage(repoRelativePath, lines);
  checkDeprecatedScriptAliasUsage(repoRelativePath, lines);
}

function checkInternalReusableWorkflow(fileName, workflowText, workflowLines) {
  if (!isInternalReusableWorkflow(fileName)) {
    return;
  }

  const onKeys = parseOnKeys(workflowLines);
  if (onKeys.size !== 1 || !onKeys.has("workflow_call")) {
    errors.push(
      `.github/workflows/${fileName}: internal reusable workflows must use workflow_call as the only trigger.`
    );
  }

  if (hasTopLevelKey(workflowLines, "concurrency")) {
    errors.push(
      `.github/workflows/${fileName}: internal reusable workflows must not define top-level concurrency.`
    );
  }

  if (parseJobs(workflowLines).size !== 1) {
    errors.push(
      `.github/workflows/${fileName}: internal reusable workflows must define exactly one job.`
    );
  }

  const nestedReusableWorkflows = extractLocalReusableWorkflowNames(workflowText);
  if (nestedReusableWorkflows.size > 0) {
    errors.push(
      `.github/workflows/${fileName}: internal reusable workflows must not call other reusable workflows.`
    );
  }
}

function checkPathScopedWorkflow(fileName, workflowText, workflowLines) {
  const pathScopes = parseWorkflowPathScopes(workflowLines);
  const events = [...pathScopes.entries()].filter(([, paths]) => paths.length > 0);
  if (events.length === 0) {
    return;
  }

  const requiredPaths = buildPathScopedWorkflowRequiredPaths(fileName, workflowText);

  for (const [eventName, patterns] of events) {
    for (const requiredPath of requiredPaths) {
      if (!hasPathCoverage(patterns, requiredPath)) {
        errors.push(
          `.github/workflows/${fileName}: ${eventName}.paths is missing coverage for ${requiredPath}.`
        );
      }
    }
  }
}

function checkCiWorkflowGovernance() {
  const ciWorkflowRepoPath = ".github/workflows/ci.yml";
  const { filters, requirements } = collectCiFilterRequirements(ciWorkflowRepoPath);

  for (const [filterName, requiredPaths] of requirements) {
    const patterns = filters.get(filterName);
    const excludedRequirements = CI_FILTER_EXCLUDED_REQUIREMENTS.get(filterName) ?? new Set();
    if (!patterns) {
      errors.push(`${ciWorkflowRepoPath}: missing dorny/paths-filter entry "${filterName}".`);
      continue;
    }

    for (const requiredPath of requiredPaths) {
      if (excludedRequirements.has(requiredPath)) {
        continue;
      }
      if (!hasPathCoverage(patterns, requiredPath)) {
        errors.push(
          `${ciWorkflowRepoPath}: filter "${filterName}" is missing coverage for ${requiredPath}.`
        );
      }
    }
  }
}

function main() {
  for (const fileName of listWorkflowFiles()) {
    const repoRelativePath = path.posix.join(".github/workflows", fileName);
    const lines = readLines(repoRelativePath);
    const text = lines.join("\n");
    checkWorkflowMetadata(fileName, lines);
    checkAutomationDefinition(repoRelativePath, lines, text);
    checkInternalReusableWorkflow(fileName, text, lines);
    checkPathScopedWorkflow(fileName, text, lines);
  }

  for (const repoRelativePath of listActionFiles()) {
    const lines = readLines(repoRelativePath);
    const text = lines.join("\n");
    checkAutomationDefinition(repoRelativePath, lines, text);
  }

  checkCiWorkflowGovernance();

  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Workflow governance check passed.\n");
}

main();
