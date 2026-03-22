import { invoke, isTauri } from "@tauri-apps/api/core";
import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import { invokeWebRuntimeDirectRpc } from "./runtimeWebDirectRpc";

type LooseResultEnvelope = Record<string, unknown>;

type RuntimeReasoningEffort = "low" | "medium" | "high" | "xhigh";
const RUNTIME_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

type RuntimeModelsRpcEnvelope = {
  ok?: boolean;
  result?: unknown;
  data?: unknown;
};

type InstructionSkillsRpcEnvelope = {
  ok?: boolean;
  result?: unknown;
  data?: unknown;
};

type RuntimeInstructionSkillSummary = {
  id: string;
  name: string;
  description?: string;
  scope?: string;
  sourceFamily?: string;
  entryPath?: string;
  sourceRoot?: string;
  enabled?: boolean;
  aliases?: string[];
  shadowedBy?: string | null;
};

type RuntimeInstructionSkillFile = {
  path: string;
  content: string;
};

export type RuntimeInstructionSkill = RuntimeInstructionSkillSummary & {
  frontmatter: Record<string, unknown>;
  body: string;
  supportingFiles: RuntimeInstructionSkillFile[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const text = normalizeText(entry);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function isTauriRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function extractInstructionSkillEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }
  const envelope = payload as InstructionSkillsRpcEnvelope;
  if (Array.isArray(envelope.result)) {
    return envelope.result;
  }
  if (Array.isArray(envelope.data)) {
    return envelope.data;
  }
  const resultRecord = isRecord(envelope.result)
    ? (envelope.result as Record<string, unknown>)
    : null;
  if (Array.isArray(resultRecord?.data)) {
    return resultRecord.data;
  }
  return [];
}

function normalizeInstructionSkillSummary(value: unknown): RuntimeInstructionSkillSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  const name = normalizeText(value.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    description: normalizeText(value.description) ?? undefined,
    scope: normalizeText(value.scope) ?? undefined,
    sourceFamily:
      normalizeText(value.sourceFamily) ?? normalizeText(value.source_family) ?? undefined,
    entryPath: normalizeText(value.entryPath) ?? normalizeText(value.entry_path) ?? undefined,
    sourceRoot: normalizeText(value.sourceRoot) ?? normalizeText(value.source_root) ?? undefined,
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    aliases: normalizeStringArray(value.aliases),
    shadowedBy: normalizeText(value.shadowedBy) ?? normalizeText(value.shadowed_by) ?? undefined,
  };
}

function normalizeInstructionSkillFile(value: unknown): RuntimeInstructionSkillFile | null {
  if (!isRecord(value)) {
    return null;
  }
  const path = normalizeText(value.path);
  const content = typeof value.content === "string" ? value.content : null;
  if (!path || content === null) {
    return null;
  }
  return { path, content };
}

function extractInstructionSkillPayload(payload: unknown): unknown {
  if (isRecord(payload)) {
    const envelope = payload as InstructionSkillsRpcEnvelope;
    if (envelope.result !== undefined) {
      return envelope.result;
    }
    if (envelope.data !== undefined) {
      return envelope.data;
    }
  }
  return payload;
}

function normalizeInstructionSkill(value: unknown): RuntimeInstructionSkill | null {
  if (!isRecord(value)) {
    return null;
  }
  const summary = normalizeInstructionSkillSummary(value);
  const body = typeof value.body === "string" ? value.body : null;
  const frontmatter = isRecord(value.frontmatter) ? value.frontmatter : {};
  const supportingFilesSource = Array.isArray(value.supportingFiles)
    ? value.supportingFiles
    : Array.isArray(value.supporting_files)
      ? value.supporting_files
      : [];
  const supportingFiles = supportingFilesSource
    .map((entry) => normalizeInstructionSkillFile(entry))
    .filter((entry): entry is RuntimeInstructionSkillFile => Boolean(entry));
  if (!summary || body === null) {
    return null;
  }
  return {
    ...summary,
    frontmatter,
    body,
    supportingFiles,
  };
}

async function listInstructionSkills(
  workspaceId: string
): Promise<RuntimeInstructionSkillSummary[]> {
  const params = { workspaceId };
  if (isTauriRuntime()) {
    const payload = await invoke("native_skills_list", params);
    return extractInstructionSkillEntries(payload)
      .map((entry) => normalizeInstructionSkillSummary(entry))
      .filter((entry): entry is RuntimeInstructionSkillSummary => Boolean(entry));
  }
  if (detectRuntimeMode() === "runtime-gateway-web") {
    const payload = await invokeWebRuntimeDirectRpc("native_skills_list", params);
    return extractInstructionSkillEntries(payload)
      .map((entry) => normalizeInstructionSkillSummary(entry))
      .filter((entry): entry is RuntimeInstructionSkillSummary => Boolean(entry));
  }
  return [];
}

export async function getInstructionSkill(
  workspaceId: string,
  skillId: string
): Promise<RuntimeInstructionSkill | null> {
  const params = { workspaceId, skillId };
  let payload: unknown;
  if (isTauriRuntime()) {
    payload = await invoke("native_skill_get", params);
  } else if (detectRuntimeMode() === "runtime-gateway-web") {
    payload = await invokeWebRuntimeDirectRpc("native_skill_get", params);
  } else {
    return null;
  }
  return normalizeInstructionSkill(extractInstructionSkillPayload(payload));
}

function titleCaseModelToken(token: string): string {
  if (token.length === 0) {
    return token;
  }
  if (/^\d+(\.\d+)*$/.test(token)) {
    return token;
  }
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatModelDisplayName(modelSlug: string): string {
  const normalizedSlug = modelSlug.trim();
  if (normalizedSlug.length === 0) {
    return modelSlug;
  }
  if (normalizedSlug.startsWith("gpt-")) {
    const [, version = "", ...rest] = normalizedSlug.split("-");
    const suffix = rest.map(titleCaseModelToken).join(" ");
    return suffix.length > 0 ? `GPT-${version} ${suffix}` : `GPT-${version}`;
  }
  return normalizedSlug.split("-").map(titleCaseModelToken).join(" ");
}

function isRuntimeReasoningEffort(value: string): value is RuntimeReasoningEffort {
  return (RUNTIME_REASONING_EFFORTS as readonly string[]).includes(value);
}

function normalizeReasoningEfforts(entry: Record<string, unknown>): RuntimeReasoningEffort[] {
  const source = Array.isArray(entry.reasoningEfforts)
    ? entry.reasoningEfforts
    : Array.isArray(entry.reasoning_efforts)
      ? entry.reasoning_efforts
      : [];
  const normalized: RuntimeReasoningEffort[] = [];
  const seen = new Set<RuntimeReasoningEffort>();
  for (const value of source) {
    const normalizedValue = normalizeText(value)?.toLowerCase();
    if (!normalizedValue || !isRuntimeReasoningEffort(normalizedValue)) {
      continue;
    }
    if (seen.has(normalizedValue)) {
      continue;
    }
    seen.add(normalizedValue);
    normalized.push(normalizedValue);
  }
  return normalized;
}

function resolveModelSlug(entry: Record<string, unknown>, index: number): string {
  return (
    normalizeText(entry.model) ??
    normalizeText(entry.modelId) ??
    normalizeText(entry.model_id) ??
    normalizeText(entry.id) ??
    `runtime-model-${index + 1}`
  );
}

function resolvePrimaryModelSlug(entry: Record<string, unknown>): string | null {
  return (
    normalizeText(entry.model) ?? normalizeText(entry.modelId) ?? normalizeText(entry.model_id)
  );
}

function resolveModelSlugFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (!isRecord(value)) {
    return null;
  }
  return (
    normalizeText(value.model) ??
    normalizeText(value.modelId) ??
    normalizeText(value.model_id) ??
    normalizeText(value.id)
  );
}

function resolveModelSlugs(entry: Record<string, unknown>, index: number): string[] {
  const resolved = new Set<string>();
  const ordered: string[] = [];
  const add = (value: unknown) => {
    const slug = resolveModelSlugFromUnknown(value);
    if (!slug || resolved.has(slug)) {
      return;
    }
    resolved.add(slug);
    ordered.push(slug);
  };

  add(resolvePrimaryModelSlug(entry));
  for (const source of [
    entry.modelIds,
    entry.model_ids,
    entry.models,
    entry.availableModels,
    entry.available_models,
  ]) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const candidate of source) {
      add(candidate);
    }
  }
  add(entry.defaultModelId);
  add(entry.default_model_id);
  if (ordered.length === 0) {
    add(normalizeText(entry.id) ?? `runtime-model-${index + 1}`);
  }
  return ordered;
}

function resolveModelBaseId(entry: Record<string, unknown>, modelSlug: string): string {
  return normalizeText(entry.id) ?? modelSlug;
}

function resolveUniqueModelId(
  baseId: string,
  modelSlug: string,
  modelIdCounts: Map<string, number>
): string {
  const count = modelIdCounts.get(baseId) ?? 0;
  modelIdCounts.set(baseId, count + 1);
  if (count === 0) {
    return baseId;
  }
  return `${baseId}::${modelSlug}`;
}

function extractRuntimeModelEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }

  const envelope = payload as RuntimeModelsRpcEnvelope;
  if (Array.isArray(envelope.result)) {
    return envelope.result;
  }
  if (Array.isArray(envelope.data)) {
    return envelope.data;
  }

  const resultRecord = isRecord(envelope.result)
    ? (envelope.result as Record<string, unknown>)
    : null;
  if (Array.isArray(resultRecord?.data)) {
    return resultRecord.data;
  }

  return [];
}

async function fetchRuntimeModelsWithWebFallback(): Promise<Record<string, unknown>[]> {
  try {
    const primary = await getRuntimeClient().models();
    return extractRuntimeModelEntries(primary).filter(isRecord);
  } catch (primaryError) {
    try {
      const payload = await invokeWebRuntimeDirectRpc("code_models_pool", {});
      return extractRuntimeModelEntries(payload).filter(isRecord);
    } catch {
      throw primaryError;
    }
  }
}

function runtimeReasoningEffortDescription(effort: RuntimeReasoningEffort) {
  if (effort === "low") {
    return "Low reasoning effort";
  }
  if (effort === "medium") {
    return "Medium reasoning effort";
  }
  if (effort === "high") {
    return "High reasoning effort";
  }
  return "Extra high reasoning effort";
}

export async function getModelList(workspaceId: string): Promise<LooseResultEnvelope> {
  void workspaceId;
  const models = await fetchRuntimeModelsWithWebFallback();
  const modelIdCounts = new Map<string, number>();
  const seenIdentity = new Set<string>();
  return {
    result: {
      data: models
        .flatMap((model, index) => {
          const modelSlugs = resolveModelSlugs(model, index);
          const primaryModelSlug = modelSlugs[0] ?? resolveModelSlug(model, index);
          const baseId = resolveModelBaseId(model, primaryModelSlug);
          const runtimeDisplayName =
            normalizeText(model.displayName) ?? normalizeText(model.display_name);
          const provider = normalizeText(model.provider) ?? "unknown";
          const capabilities = normalizeStringArray(model.capabilities);
          const description =
            capabilities.length > 0 ? `${provider} (${capabilities.join(", ")})` : provider;
          const reasoningEfforts = normalizeReasoningEfforts(model);
          const defaultReasoningEffort = reasoningEfforts[0] ?? null;
          const declaredDefaultModelSlug =
            normalizeText(model.defaultModelId) ?? normalizeText(model.default_model_id);
          return modelSlugs
            .map((modelSlug, slugIndex) => {
              const identity = `${baseId}::${modelSlug}`;
              if (seenIdentity.has(identity)) {
                return null;
              }
              seenIdentity.add(identity);
              const uniqueId = resolveUniqueModelId(baseId, modelSlug, modelIdCounts);
              const isDefault =
                declaredDefaultModelSlug !== null
                  ? declaredDefaultModelSlug === modelSlug
                  : Boolean(model.isDefault ?? model.is_default ?? false) && slugIndex === 0;
              const displayName =
                modelSlugs.length === 1 && slugIndex === 0
                  ? (runtimeDisplayName ?? formatModelDisplayName(modelSlug))
                  : formatModelDisplayName(modelSlug);
              return {
                id: uniqueId,
                model: modelSlug,
                displayName,
                display_name: displayName,
                provider,
                pool: normalizeText(model.pool),
                source: normalizeText(model.source),
                available: model.available !== false,
                description,
                supportedReasoningEfforts: reasoningEfforts.map((effort) => ({
                  reasoningEffort: effort,
                  reasoning_effort: effort,
                  description: runtimeReasoningEffortDescription(effort),
                })),
                supported_reasoning_efforts: reasoningEfforts.map((effort) => ({
                  reasoningEffort: effort,
                  reasoning_effort: effort,
                  description: runtimeReasoningEffortDescription(effort),
                })),
                defaultReasoningEffort,
                default_reasoning_effort: defaultReasoningEffort,
                isDefault,
                is_default: isDefault,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    },
  };
}

export async function getSkillsList(workspaceId: string): Promise<LooseResultEnvelope> {
  const skills = await listInstructionSkills(workspaceId);
  const mappedSkills = skills.map((skill) => {
    const aliases = skill.aliases ?? [];
    return {
      name: skill.name,
      path: skill.id,
      description: skill.description,
      ...(skill.scope ? { scope: skill.scope } : {}),
      ...(skill.sourceFamily ? { sourceFamily: skill.sourceFamily } : {}),
      ...(typeof skill.enabled === "boolean" ? { enabled: skill.enabled } : {}),
      ...(aliases.length > 0 ? { aliases } : {}),
      ...(skill.shadowedBy ? { shadowedBy: skill.shadowedBy } : { shadowedBy: null }),
    };
  });
  return {
    result: {
      skills: mappedSkills,
    },
    skills: mappedSkills,
  };
}

export async function listRuntimeModels() {
  return getRuntimeClient().models();
}
