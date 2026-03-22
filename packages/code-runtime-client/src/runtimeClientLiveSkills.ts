import type { LiveSkillExecuteRequest } from "@ku0/code-runtime-host-contract";

const LIVE_SKILL_NETWORK_QUERY_MAX_CHARS = 2_048;
const LIVE_SKILL_CORE_SHELL_COMMAND_MAX_CHARS = 8_192;
const LIVE_SKILL_CORE_GREP_PATTERN_MAX_CHARS = 2_048;
const LIVE_SKILL_CORE_GREP_MAX_RESULTS = 2_000;
const LIVE_SKILL_CORE_GREP_MAX_CONTEXT_LINES = 10;

const LIVE_SKILL_ACCEPTED_IDS = {
  "network-analysis": ["network-analysis", "network_analysis"],
  "research-orchestrator": ["research-orchestrator", "research_orchestrator", "research"],
  "core-read": ["core-read", "read", "file-read", "file_read", "read-file", "read_file"],
  "core-tree": ["core-tree", "tree", "file-tree", "file_tree", "ls"],
  "core-grep": ["core-grep", "grep", "rg", "search", "file-search", "file_search"],
  "core-write": ["core-write", "write", "file-write", "file_write", "write-file", "write_file"],
  "core-edit": ["core-edit", "edit", "file-edit", "file_edit", "edit-file", "edit_file"],
  "core-bash": ["core-bash", "bash", "shell", "shell-command", "shell_command"],
  "core-js-repl": ["core-js-repl", "js-repl", "js_repl", "javascript-repl", "javascript_repl"],
  "core-js-repl-reset": [
    "core-js-repl-reset",
    "js-repl-reset",
    "js_repl_reset",
    "javascript-repl-reset",
    "javascript_repl_reset",
    "reset-js-repl",
    "reset_js_repl",
  ],
  "core-diagnostics": [
    "core-diagnostics",
    "diagnostics",
    "workspace-diagnostics",
    "workspace_diagnostics",
  ],
  "core-computer-observe": [
    "core-computer-observe",
    "computer-observe",
    "computer_observe",
    "observe-computer",
    "observe-computer-screen",
  ],
} as const satisfies Record<string, readonly string[]>;

const LIVE_SKILL_CANONICAL_IDS_BY_ALIAS = new Map<string, string>(
  Object.entries(LIVE_SKILL_ACCEPTED_IDS).flatMap(([canonicalSkillId, acceptedSkillIds]) =>
    acceptedSkillIds.map((skillId) => [skillId, canonicalSkillId] as const)
  )
);

export type RuntimeLiveSkillAliasSource = {
  id: string;
  aliases?: string[] | null;
};

export function normalizeLiveSkillLookupId(skillId: string): string {
  return skillId.trim().toLowerCase();
}

function normalizeLiveSkillAliasList(aliases: string[] | null | undefined): string[] {
  const entries = Array.isArray(aliases) ? aliases : [];
  const normalizedEntries = new Map<string, string>();
  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmedEntry = entry.trim();
    const lookupId = normalizeLiveSkillLookupId(trimmedEntry);
    if (lookupId.length === 0 || normalizedEntries.has(lookupId)) {
      continue;
    }
    normalizedEntries.set(lookupId, trimmedEntry);
  }
  return [...normalizedEntries.values()];
}

export function canonicalizeLiveSkillId(skillId: string): string | null {
  const normalizedSkillId = normalizeLiveSkillLookupId(skillId);
  return LIVE_SKILL_CANONICAL_IDS_BY_ALIAS.get(normalizedSkillId) ?? null;
}

export function listAcceptedLiveSkillIds(skillId: string): string[] {
  const canonicalSkillId = canonicalizeLiveSkillId(skillId);
  if (!canonicalSkillId) {
    const normalizedSkillId = skillId.trim();
    return normalizedSkillId.length > 0 ? [normalizedSkillId] : [];
  }
  return [...LIVE_SKILL_ACCEPTED_IDS[canonicalSkillId as keyof typeof LIVE_SKILL_ACCEPTED_IDS]];
}

export function listAcceptedLiveSkillIdsFromCatalogSkill(
  skill: RuntimeLiveSkillAliasSource
): string[] {
  const normalizedSkillId = skill.id.trim();
  if (normalizedSkillId.length === 0) {
    return [];
  }
  const canonicalSkillId = canonicalizeLiveSkillId(normalizedSkillId) ?? normalizedSkillId;
  const normalizedEntries = new Map<string, string>();
  for (const entry of [
    normalizedSkillId,
    canonicalSkillId,
    ...normalizeLiveSkillAliasList(skill.aliases),
    ...listAcceptedLiveSkillIds(normalizedSkillId),
  ]) {
    const lookupId = normalizeLiveSkillLookupId(entry);
    if (lookupId.length === 0 || normalizedEntries.has(lookupId)) {
      continue;
    }
    normalizedEntries.set(lookupId, entry.trim());
  }
  return [...normalizedEntries.values()];
}

function isNetworkLiveSkillId(skillId: string): boolean {
  return canonicalizeLiveSkillId(skillId) === "network-analysis";
}

function isCoreShellLiveSkillId(skillId: string): boolean {
  return canonicalizeLiveSkillId(skillId) === "core-bash";
}

function isCoreGrepLiveSkillId(skillId: string): boolean {
  return canonicalizeLiveSkillId(skillId) === "core-grep";
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveLiveSkillQuery(request: LiveSkillExecuteRequest): string {
  const explicitQuery = normalizeNullableText(request.options?.query ?? null);
  if (explicitQuery) {
    return explicitQuery;
  }
  return normalizeNullableText(request.input) ?? "";
}

function resolveCoreShellCommand(request: LiveSkillExecuteRequest): string {
  const explicitCommand = normalizeNullableText(request.options?.command ?? null);
  if (explicitCommand) {
    return explicitCommand;
  }
  return normalizeNullableText(request.input) ?? "";
}

function resolveCoreGrepPattern(request: LiveSkillExecuteRequest): string {
  const explicitPattern = normalizeNullableText(request.options?.pattern ?? null);
  if (explicitPattern) {
    return explicitPattern;
  }
  const explicitQuery = normalizeNullableText(request.options?.query ?? null);
  if (explicitQuery) {
    return explicitQuery;
  }
  return normalizeNullableText(request.input) ?? "";
}

function validateCoreGrepContextValue(value: number | null | undefined, label: string): void {
  if (value === null || value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 0 || value > LIVE_SKILL_CORE_GREP_MAX_CONTEXT_LINES) {
    throw new Error(
      `${label} must be an integer between 0 and ${LIVE_SKILL_CORE_GREP_MAX_CONTEXT_LINES}.`
    );
  }
}

export function validateLiveSkillExecuteRequest(request: LiveSkillExecuteRequest): void {
  if (isNetworkLiveSkillId(request.skillId)) {
    const query = resolveLiveSkillQuery(request);
    if (query) {
      const queryLength = Array.from(query).length;
      if (queryLength > LIVE_SKILL_NETWORK_QUERY_MAX_CHARS) {
        throw new Error(
          `Live skill query must be <= ${LIVE_SKILL_NETWORK_QUERY_MAX_CHARS} characters.`
        );
      }
    }
  }

  if (isCoreShellLiveSkillId(request.skillId)) {
    const command = resolveCoreShellCommand(request);
    if (command) {
      const commandLength = Array.from(command).length;
      if (commandLength > LIVE_SKILL_CORE_SHELL_COMMAND_MAX_CHARS) {
        throw new Error(
          `command must be <= ${LIVE_SKILL_CORE_SHELL_COMMAND_MAX_CHARS} characters.`
        );
      }
    }
  }

  if (isCoreGrepLiveSkillId(request.skillId)) {
    const pattern = resolveCoreGrepPattern(request);
    if (!pattern) {
      throw new Error("pattern is required for core-grep.");
    }
    const patternLength = Array.from(pattern).length;
    if (patternLength > LIVE_SKILL_CORE_GREP_PATTERN_MAX_CHARS) {
      throw new Error(`pattern must be <= ${LIVE_SKILL_CORE_GREP_PATTERN_MAX_CHARS} characters.`);
    }

    const matchMode = request.options?.matchMode ?? null;
    if (matchMode !== null && matchMode !== "literal" && matchMode !== "regex") {
      throw new Error("matchMode must be literal or regex.");
    }

    const maxResults = request.options?.maxResults ?? null;
    if (
      maxResults !== null &&
      maxResults !== undefined &&
      (!Number.isInteger(maxResults) ||
        maxResults < 1 ||
        maxResults > LIVE_SKILL_CORE_GREP_MAX_RESULTS)
    ) {
      throw new Error(
        `maxResults must be an integer between 1 and ${LIVE_SKILL_CORE_GREP_MAX_RESULTS}.`
      );
    }

    validateCoreGrepContextValue(request.options?.contextBefore ?? null, "contextBefore");
    validateCoreGrepContextValue(request.options?.contextAfter ?? null, "contextAfter");
  }
}

export function normalizeLiveSkillExecuteRequest(
  request: LiveSkillExecuteRequest
): LiveSkillExecuteRequest {
  const canonicalSkillId = canonicalizeLiveSkillId(request.skillId);
  if (!canonicalSkillId || canonicalSkillId === request.skillId) {
    return request;
  }
  return {
    ...request,
    skillId: canonicalSkillId,
  };
}
