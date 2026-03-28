import { listWorkspaceFileEntries, readWorkspaceFile } from "../ports/tauriWorkspaceFiles";

export const REPOSITORY_SKILLS_DIRECTORY = ".hugecode/skills";
export const REPOSITORY_SKILL_MANIFEST_SUFFIX = "/manifest.json";

export type RuntimeWorkspaceSkillManifestCompatibility = {
  minRuntime: string;
  maxRuntime: string | null;
  minApp: string | null;
  maxApp: string | null;
};

export type RuntimeWorkspaceSkillManifest = {
  id: string;
  name: string;
  version: string;
  kind: "skill" | "source";
  trustLevel: "verified" | "community" | "local";
  entrypoint: string | null;
  permissions: string[];
  compatibility: RuntimeWorkspaceSkillManifestCompatibility;
  manifestPath: string;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSkillIds(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function readSkillManifestCompatibility(
  value: unknown,
  context: string
): RuntimeWorkspaceSkillManifestCompatibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const minRuntime = readOptionalText(record.min_runtime);
  if (!minRuntime) {
    throw new Error(`${context}.min_runtime is required.`);
  }
  return {
    minRuntime,
    maxRuntime: readOptionalText(record.max_runtime),
    minApp: readOptionalText(record.min_app),
    maxApp: readOptionalText(record.max_app),
  };
}

export function parseRuntimeWorkspaceSkillManifest(
  raw: string,
  manifestPath: string
): RuntimeWorkspaceSkillManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid workspace skill manifest at ${manifestPath}.`);
  }
  const record = parsed as Record<string, unknown>;
  if (record.schema_version !== "skills_source_manifest.v1") {
    throw new Error(
      `Unsupported workspace skill manifest schema \`${String(record.schema_version ?? "unknown")}\` at ${manifestPath}.`
    );
  }
  const id = readOptionalText(record.id);
  const name = readOptionalText(record.name);
  const version = readOptionalText(record.version);
  const kind = readOptionalText(record.kind);
  const trustLevel = readOptionalText(record.trust_level);
  if (!id || !name || !version || !kind || !trustLevel) {
    throw new Error(`Workspace skill manifest ${manifestPath} is missing required fields.`);
  }
  if (kind !== "skill" && kind !== "source") {
    throw new Error(`${manifestPath} must declare kind skill or source.`);
  }
  if (trustLevel !== "verified" && trustLevel !== "community" && trustLevel !== "local") {
    throw new Error(`${manifestPath} must declare trust_level verified, community, or local.`);
  }
  return {
    id,
    name,
    version,
    kind,
    trustLevel,
    entrypoint: readOptionalText(record.entrypoint),
    permissions: normalizeSkillIds(record.permissions ?? [], `${manifestPath}.permissions`),
    compatibility: readSkillManifestCompatibility(
      record.compatibility,
      `${manifestPath}.compatibility`
    ),
    manifestPath,
  };
}

export async function readRuntimeWorkspaceSkillManifests(
  workspaceId: string
): Promise<RuntimeWorkspaceSkillManifest[]> {
  const workspaceFiles = await listWorkspaceFileEntries(workspaceId);
  const manifestFiles = workspaceFiles
    .filter(
      (file) =>
        file.path.startsWith(`${REPOSITORY_SKILLS_DIRECTORY}/`) &&
        file.path.endsWith(REPOSITORY_SKILL_MANIFEST_SUFFIX)
    )
    .sort((left, right) => left.path.localeCompare(right.path));

  return Promise.all(
    manifestFiles.map(async (file) => {
      const payload = await readWorkspaceFile(workspaceId, file.id);
      const content = readOptionalText(payload?.content);
      if (!content) {
        throw new Error(`Workspace skill manifest ${file.path} is empty.`);
      }
      return parseRuntimeWorkspaceSkillManifest(content, file.path);
    })
  );
}
