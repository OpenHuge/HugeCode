export const LIVE_SKILL_ACCEPTED_IDS = {
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
