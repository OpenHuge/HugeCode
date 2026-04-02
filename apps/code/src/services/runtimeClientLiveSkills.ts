import type { LiveSkillExecuteRequest } from "@ku0/code-runtime-host-contract";
import {
  canonicalizeLiveSkillId,
  listAcceptedLiveSkillIds,
  listAcceptedLiveSkillIdsFromCatalogSkill,
  normalizeLiveSkillLookupId,
  type RuntimeLiveSkillAliasSource,
} from "@ku0/code-application/runtimeLiveSkillAliases";
export {
  canonicalizeLiveSkillId,
  listAcceptedLiveSkillIds,
  listAcceptedLiveSkillIdsFromCatalogSkill,
  normalizeLiveSkillLookupId,
};
export type { RuntimeLiveSkillAliasSource };

const LIVE_SKILL_NETWORK_QUERY_MAX_CHARS = 2_048;
const LIVE_SKILL_CORE_SHELL_COMMAND_MAX_CHARS = 8_192;
const LIVE_SKILL_CORE_GREP_PATTERN_MAX_CHARS = 2_048;
const LIVE_SKILL_CORE_GREP_MAX_RESULTS = 2_000;
const LIVE_SKILL_CORE_GREP_MAX_CONTEXT_LINES = 10;

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
