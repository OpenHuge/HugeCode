import type {
  AcpIntegrationSummary,
  AcpIntegrationTransport,
  AcpIntegrationUpsertInput,
} from "../../../../../application/runtime/ports/tauriRemoteServers";

export type AcpBackendFormMode = "add" | "edit";

export type AcpKeyValueEntry = {
  id: string;
  key: string;
  value: string;
};

export type AcpKeyValueValidationIssue = {
  entryId: string;
  field: "key" | "value";
  message: string;
};

export type AcpKeyValueValidationResult = {
  issues: AcpKeyValueValidationIssue[];
  isValid: boolean;
};

export type AcpBackendFormState = {
  integrationId: string;
  backendId: string;
  displayName: string;
  state: AcpIntegrationUpsertInput["state"];
  backendClass: NonNullable<AcpIntegrationUpsertInput["backendClass"]>;
  specializationsText: string;
  transport: AcpIntegrationTransport;
  command: string;
  argsText: string;
  cwd: string;
  envEntries: AcpKeyValueEntry[];
  endpoint: string;
  experimentalHttp: boolean;
  headerEntries: AcpKeyValueEntry[];
  capabilitiesText: string;
  maxConcurrency: string;
  costTier: string;
  latencyClass: string;
};

function splitMultiline(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function joinMultiline(values: string[]): string {
  return values.join("\n");
}

function formatKeyValueEntries(
  entries: Record<string, string>,
  prefix: string
): AcpKeyValueEntry[] {
  return Object.entries(entries)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value], index) => ({
      id: `${prefix}-${index}`,
      key,
      value,
    }));
}

function parseKeyValueEntries(
  entries: AcpKeyValueEntry[],
  kind: "environment" | "header"
): Record<string, string> {
  const validation = validateAcpKeyValueEntries(entries, kind);
  if (!validation.isValid) {
    throw new Error(validation.issues[0]?.message ?? "Invalid ACP key-value entries.");
  }
  return entries.reduce<Record<string, string>>((result, entry) => {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (!key && !value) {
      return result;
    }
    result[key] = value;
    return result;
  }, {});
}

function normalizeDuplicateLookupKey(kind: "environment" | "header", key: string): string {
  return kind === "header" ? key.toLowerCase() : key;
}

export function validateAcpKeyValueEntries(
  entries: AcpKeyValueEntry[],
  kind: "environment" | "header"
): AcpKeyValueValidationResult {
  const issues: AcpKeyValueValidationIssue[] = [];
  const seenKeys = new Map<string, string[]>();

  for (const entry of entries) {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (!key && !value) {
      continue;
    }
    if (!key) {
      issues.push({
        entryId: entry.id,
        field: "key",
        message:
          kind === "environment"
            ? "Environment entry is missing a key."
            : "Header entry is missing a name.",
      });
      continue;
    }
    if (!value) {
      issues.push({
        entryId: entry.id,
        field: "value",
        message:
          kind === "environment"
            ? `Environment key "${key}" is missing a value.`
            : `Header "${key}" is missing a value.`,
      });
      continue;
    }

    const lookupKey = normalizeDuplicateLookupKey(kind, key);
    const duplicates = seenKeys.get(lookupKey) ?? [];
    seenKeys.set(lookupKey, [...duplicates, entry.id]);
  }

  for (const [lookupKey, entryIds] of seenKeys.entries()) {
    if (entryIds.length < 2) {
      continue;
    }
    const duplicateLabel =
      entries
        .find((entry) => normalizeDuplicateLookupKey(kind, entry.key.trim()) === lookupKey)
        ?.key.trim() ?? lookupKey;
    for (const entryId of entryIds) {
      issues.push({
        entryId,
        field: "key",
        message:
          kind === "environment"
            ? `Duplicate environment key "${duplicateLabel}".`
            : `Duplicate header name "${duplicateLabel}".`,
      });
    }
  }

  return {
    issues,
    isValid: issues.length === 0,
  };
}

export function createEmptyAcpBackendFormState(): AcpBackendFormState {
  return {
    integrationId: "",
    backendId: "",
    displayName: "",
    state: "active",
    backendClass: "primary",
    specializationsText: "",
    transport: "stdio",
    command: "codex",
    argsText: "",
    cwd: "",
    envEntries: [],
    endpoint: "http://127.0.0.1:8788",
    experimentalHttp: true,
    headerEntries: [],
    capabilitiesText: "general",
    maxConcurrency: "1",
    costTier: "standard",
    latencyClass: "standard",
  };
}

export function mapAcpIntegrationToFormState(
  integration: AcpIntegrationSummary
): AcpBackendFormState {
  const baseState = createEmptyAcpBackendFormState();
  const transportConfig = integration.transportConfig;
  const args = transportConfig.transport === "stdio" ? (transportConfig.args ?? []) : [];
  const env = transportConfig.transport === "stdio" ? (transportConfig.env ?? {}) : {};
  const headers = transportConfig.transport === "http" ? (transportConfig.headers ?? {}) : {};
  return {
    ...baseState,
    integrationId: integration.integrationId,
    backendId: integration.backendId,
    displayName: integration.displayName,
    state: integration.state,
    backendClass: integration.backendClass ?? "primary",
    specializationsText: joinMultiline(integration.specializations ?? []),
    transport: integration.transport,
    capabilitiesText: joinMultiline(integration.capabilities),
    maxConcurrency: `${integration.maxConcurrency}`,
    costTier: integration.costTier,
    latencyClass: integration.latencyClass,
    ...(transportConfig.transport === "stdio"
      ? {
          command: transportConfig.command,
          argsText: joinMultiline(args),
          cwd: transportConfig.cwd ?? "",
          envEntries: formatKeyValueEntries(env, "env"),
        }
      : {
          endpoint: transportConfig.endpoint,
          experimentalHttp: transportConfig.experimental ?? true,
          headerEntries: formatKeyValueEntries(headers, "header"),
        }),
  };
}

export function mapAcpFormStateToUpsertInput(
  draft: AcpBackendFormState
): AcpIntegrationUpsertInput {
  const integrationId = draft.integrationId.trim();
  if (!integrationId) {
    throw new Error("ACP integration ID is required.");
  }
  const displayName = draft.displayName.trim();
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  const maxConcurrency = Number.parseInt(draft.maxConcurrency.trim(), 10);
  if (!Number.isFinite(maxConcurrency) || maxConcurrency <= 0) {
    throw new Error("Max concurrency must be a positive integer.");
  }

  const transportConfig =
    draft.transport === "stdio"
      ? {
          transport: "stdio" as const,
          command: draft.command.trim(),
          args: splitMultiline(draft.argsText),
          cwd: draft.cwd.trim() || undefined,
          env: parseKeyValueEntries(draft.envEntries, "environment"),
        }
      : {
          transport: "http" as const,
          endpoint: draft.endpoint.trim(),
          experimental: draft.experimentalHttp,
          headers: parseKeyValueEntries(draft.headerEntries, "header"),
        };

  if (transportConfig.transport === "stdio" && !transportConfig.command) {
    throw new Error("ACP stdio command is required.");
  }
  if (transportConfig.transport === "http" && !transportConfig.endpoint) {
    throw new Error("ACP HTTP endpoint is required.");
  }

  return {
    integrationId,
    displayName,
    backendId: draft.backendId.trim() || undefined,
    state: draft.state,
    backendClass: draft.backendClass,
    specializations: splitMultiline(draft.specializationsText),
    transportConfig,
    capabilities: splitMultiline(draft.capabilitiesText),
    maxConcurrency,
    costTier: draft.costTier.trim() || "standard",
    latencyClass: draft.latencyClass.trim() || "standard",
  };
}
