import type {
  ActiveInvocationCatalog,
  InvocationAudience,
  InvocationDescriptor,
  InvocationReadiness,
  InvocationReadinessState,
  PromptLibraryEntry,
  RuntimeToolDescriptor,
  KernelCapabilityDescriptor,
  KernelExtensionBundle,
  RuntimeExtensionToolSummary,
} from "@ku0/code-runtime-host-contract";
import {
  summarizeInvocationExecutionCatalog,
  withInvocationExecutionPlan,
} from "@ku0/code-application/runtimeInvocationExecution";
import type { RuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPluginTypes";
import { mergeRuntimeKernelProjectionPlugins } from "../facades/runtimeKernelPluginProjection";

export type RuntimeToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export type RuntimeInvocationCatalogFacade = {
  readActiveCatalog: () => Promise<ActiveInvocationCatalog>;
  publishActiveCatalog: (input?: {
    audience?: InvocationAudience;
  }) => Promise<ActiveInvocationCatalog>;
  searchActiveCatalog: (
    query: string,
    input?: {
      audience?: InvocationAudience;
    }
  ) => Promise<InvocationDescriptor[]>;
  getInvocationDescriptor: (
    id: string,
    input?: {
      audience?: InvocationAudience;
    }
  ) => Promise<InvocationDescriptor | null>;
  resolveInvocationDescriptor: (id: string) => Promise<InvocationDescriptor | null>;
};

type RuntimeInvocationCatalogInput = {
  workspaceId: string;
  pluginCatalog: Pick<RuntimeKernelPluginCatalogFacade, "listPlugins">;
  readProjection?: () => Promise<{
    projectionBacked: boolean;
    extensionBundles: KernelExtensionBundle[] | null;
    capabilities: KernelCapabilityDescriptor[] | null;
  }>;
  listRuntimeExtensionTools?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<RuntimeExtensionToolSummary[]>;
  listRuntimePrompts?: (workspaceId?: string | null) => Promise<PromptLibraryEntry[]>;
};

type NormalizedCatalogCandidate = {
  descriptor: InvocationDescriptor;
  precedence: number;
  winningSource: string;
};

const BUILT_IN_RUNTIME_TOOLS: ReadonlyArray<{
  id: string;
  title: string;
  summary: string;
  tool: RuntimeToolDescriptor;
  safety: InvocationDescriptor["safety"];
}> = [
  {
    id: "tool:start-runtime-run",
    title: "Start Runtime Run",
    summary: "Launch a runtime-owned run for a multi-step engineering task.",
    tool: {
      toolName: "start-runtime-run",
      scope: "runtime",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          title: { type: "string" },
          objective: { type: "string" },
        },
      },
      description: "Start a runtime-owned run.",
      promptDescription: "Launch a durable runtime run when the task exceeds a single tool call.",
    },
    safety: {
      level: "write",
      readOnly: false,
      destructive: false,
      openWorld: false,
      idempotent: false,
    },
  },
  {
    id: "tool:run-runtime-live-skill",
    title: "Run Runtime Live Skill",
    summary: "Execute a bounded runtime live skill directly by canonical skill id.",
    tool: {
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      inputSchema: {
        type: "object",
        properties: {
          skillId: { type: "string" },
          input: { type: "string" },
          options: { type: "object", additionalProperties: true },
        },
        required: ["skillId", "input"],
      },
      description: "Execute an enabled runtime live skill.",
      promptDescription: "Use this for bounded skill execution before escalating to a full run.",
    },
    safety: {
      level: "write",
      readOnly: false,
      destructive: false,
      openWorld: true,
      idempotent: false,
    },
  },
] as const;

const SESSION_COMMANDS: ReadonlyArray<{
  id: string;
  title: string;
  summary: string;
  argumentSchema: Record<string, unknown>;
}> = [
  {
    id: "session:send-message",
    title: "Send Session Message",
    summary: "Compatibility thread-send surface for an existing runtime session.",
    argumentSchema: {
      type: "object",
      properties: {
        threadId: { type: "string" },
        text: { type: "string" },
      },
      required: ["threadId", "text"],
    },
  },
  {
    id: "session:respond-to-approval",
    title: "Respond To Approval",
    summary: "Resolve a runtime approval request inside an existing session flow.",
    argumentSchema: {
      type: "object",
      properties: {
        requestId: { type: ["string", "number"] },
        decision: { type: "string", enum: ["accept", "decline"] },
      },
      required: ["requestId", "decision"],
    },
  },
] as const;

const BUILT_IN_SLASH_COMMAND_NAMES = new Set([
  "compact",
  "fork",
  "mcp",
  "new",
  "resume",
  "review",
  "status",
]);

function toInvocationReadiness(input: {
  state: InvocationReadinessState;
  available: boolean;
  reason?: string | null;
  warnings?: string[];
}): InvocationReadiness {
  return {
    state: input.state,
    available: input.available,
    reason: input.reason ?? null,
    warnings: input.warnings ?? [],
    checkedAt: null,
  };
}

function createBuiltInRuntimeToolDescriptor(
  workspaceId: string,
  descriptor: (typeof BUILT_IN_RUNTIME_TOOLS)[number]
): InvocationDescriptor {
  return withInvocationExecutionPlan({
    id: descriptor.id,
    title: descriptor.title,
    summary: descriptor.summary,
    description: descriptor.tool.description,
    kind: "runtime_tool",
    source: {
      kind: "runtime_tool",
      contributionType: "built_in",
      authority: "runtime",
      label: "Runtime tool catalog",
      sourceId: descriptor.tool.toolName,
      workspaceId,
      provenance: null,
    },
    runtimeTool: descriptor.tool,
    argumentSchema: descriptor.tool.inputSchema,
    aliases: [],
    tags: ["track-a"],
    safety: descriptor.safety,
    exposure: {
      operatorVisible: true,
      modelVisible: true,
      requiresReadiness: true,
      hiddenReason: null,
    },
    readiness: toInvocationReadiness({
      state: "ready",
      available: true,
    }),
    metadata: {
      invocationPlane: {
        winningSource: "built_in_runtime_tool",
      },
    },
  });
}

function createSessionCommandDescriptor(
  workspaceId: string,
  descriptor: (typeof SESSION_COMMANDS)[number]
): InvocationDescriptor {
  return withInvocationExecutionPlan({
    id: descriptor.id,
    title: descriptor.title,
    summary: descriptor.summary,
    description: descriptor.summary,
    kind: "session_command",
    source: {
      kind: "session_command",
      contributionType: "session_scoped",
      authority: "session",
      label: "Runtime session commands",
      sourceId: descriptor.id,
      workspaceId,
      provenance: null,
    },
    runtimeTool: null,
    argumentSchema: descriptor.argumentSchema,
    aliases: [],
    tags: ["compatibility"],
    safety: {
      level: "write",
      readOnly: false,
      destructive: false,
      openWorld: false,
      idempotent: false,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: false,
      requiresReadiness: false,
      hiddenReason: "Session commands stay operator-only in Track A.",
    },
    readiness: toInvocationReadiness({
      state: "ready",
      available: true,
    }),
    metadata: {
      invocationPlane: {
        winningSource: "session_command",
      },
    },
  });
}

function mapPluginReadiness(plugin: RuntimeKernelPluginDescriptor): InvocationReadiness {
  if (plugin.operations.execution.executable) {
    return toInvocationReadiness({
      state: plugin.health?.state === "degraded" ? "attention" : "ready",
      available: true,
      warnings: plugin.health?.warnings ?? [],
    });
  }

  return toInvocationReadiness({
    state: plugin.health?.state === "unsupported" ? "unsupported" : "blocked",
    available: false,
    reason: plugin.operations.execution.reason ?? null,
    warnings: plugin.health?.warnings ?? [],
  });
}

function mapPluginSource(plugin: RuntimeKernelPluginDescriptor): InvocationDescriptor["source"] {
  if (plugin.source === "live_skill") {
    return {
      kind: "live_skill",
      contributionType: "skill_derived",
      authority: "runtime",
      label: "Runtime live skills",
      sourceId: plugin.id,
      workspaceId: plugin.workspaceId,
      provenance: plugin.metadata ?? null,
    };
  }
  if (plugin.source === "repo_manifest") {
    return {
      kind: "workspace_skill_manifest",
      contributionType: "skill_derived",
      authority: "workspace",
      label: "Workspace skill manifests",
      sourceId: plugin.id,
      workspaceId: plugin.workspaceId,
      provenance: plugin.metadata ?? null,
    };
  }
  return {
    kind: "runtime_extension",
    contributionType: "extension_contributed",
    authority: "runtime",
    label: "Runtime plugin catalog",
    sourceId: plugin.id,
    workspaceId: plugin.workspaceId,
    provenance: plugin.metadata ?? null,
  };
}

function createPluginInvocationDescriptor(
  plugin: RuntimeKernelPluginDescriptor
): InvocationDescriptor {
  const aliases = Array.isArray(plugin.metadata?.aliases)
    ? plugin.metadata.aliases.filter((value): value is string => typeof value === "string")
    : [];
  const openWorld =
    plugin.permissions.includes("network") ||
    plugin.executionBoundaries.includes("remote") ||
    plugin.executionBoundaries.includes("network");

  return withInvocationExecutionPlan({
    id: `plugin:${plugin.id}`,
    title: plugin.name,
    summary: plugin.summary ?? plugin.name,
    description: plugin.summary,
    kind: "plugin",
    source: mapPluginSource(plugin),
    runtimeTool: null,
    argumentSchema:
      plugin.source === "live_skill"
        ? {
            type: "object",
            properties: {
              input: { type: "string" },
              context: { type: "object", additionalProperties: true },
              options: { type: "object", additionalProperties: true },
            },
            required: ["input"],
          }
        : null,
    aliases,
    tags: plugin.capabilities.map((capability) => capability.id),
    safety: {
      level: plugin.permissions.length > 0 ? "write" : "read",
      readOnly: plugin.permissions.length === 0,
      destructive: false,
      openWorld,
      idempotent: false,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: plugin.source === "live_skill",
      requiresReadiness: true,
      hiddenReason:
        plugin.source === "live_skill"
          ? null
          : "Track A exposes non-live plugin entries to operators only.",
    },
    readiness: mapPluginReadiness(plugin),
    metadata: {
      ...(plugin.metadata ?? {}),
      invocationPlane: {
        winningSource:
          plugin.source === "runtime_extension" && plugin.metadata?.kernelExtensionBundle
            ? "projection_extension_bundle"
            : "plugin_catalog",
      },
    },
  });
}

function createRuntimeExtensionToolDescriptor(input: {
  workspaceId: string;
  plugin: RuntimeKernelPluginDescriptor;
  tool: RuntimeExtensionToolSummary;
}): InvocationDescriptor {
  const readOnly = input.tool.readOnly;
  return withInvocationExecutionPlan({
    id: `tool:${input.tool.toolName}`,
    title: input.tool.toolName,
    summary: input.tool.description,
    description: input.tool.description,
    kind: "runtime_tool",
    source: {
      kind: "runtime_extension",
      contributionType: "extension_contributed",
      authority: "runtime",
      label: "Runtime extension tools",
      sourceId: input.plugin.id,
      workspaceId: input.plugin.workspaceId ?? input.workspaceId,
      provenance: {
        toolName: input.tool.toolName,
      },
    },
    runtimeTool: {
      toolName: input.tool.toolName,
      scope: "runtime",
      inputSchema: input.tool.inputSchema,
      description: input.tool.description,
      promptDescription: input.tool.description,
    },
    argumentSchema: input.tool.inputSchema,
    aliases: [],
    tags: ["runtime_extension", input.plugin.id],
    safety: {
      level: readOnly ? "read" : "write",
      readOnly,
      destructive: false,
      openWorld: true,
      idempotent: readOnly,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: input.plugin.enabled,
      requiresReadiness: true,
      hiddenReason: input.plugin.enabled
        ? null
        : "Disabled runtime extension tools stay operator-only until re-enabled.",
    },
    readiness: input.plugin.enabled
      ? toInvocationReadiness({
          state: "ready",
          available: true,
        })
      : toInvocationReadiness({
          state: "blocked",
          available: false,
          reason: `Runtime extension \`${input.plugin.id}\` is disabled.`,
        }),
    metadata: {
      invocationPlane: {
        winningSource: "runtime_extension_tool",
      },
      extensionId: input.plugin.id,
    },
  });
}

function promptArgumentNames(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\$[A-Z][A-Z0-9_]*/g)) {
    const index = match.index ?? 0;
    if (index > 0 && content[index - 1] === "$") {
      continue;
    }
    const name = match[0].slice(1);
    if (name === "ARGUMENTS" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function buildPromptArgumentHint(prompt: PromptLibraryEntry): string | null {
  const names = promptArgumentNames(prompt.content);
  if (names.length === 0) {
    return null;
  }
  return names.map((name) => `${name}=`).join(" ");
}

function buildPromptInsertText(
  prompt: PromptLibraryEntry,
  shadowedByBuiltin: boolean
): { text: string; cursorOffset?: number } {
  const hint = buildPromptArgumentHint(prompt);
  const commandName = shadowedByBuiltin ? `prompts:${prompt.title}` : prompt.title;
  if (!hint) {
    return { text: commandName };
  }
  const names = hint
    .split(/\s+/)
    .map((entry) => entry.replace(/=$/, ""))
    .filter((entry) => entry.length > 0);
  let text = commandName;
  let cursorOffset: number | undefined;
  for (const name of names) {
    if (cursorOffset === undefined) {
      cursorOffset = text.length + 1 + name.length + 2;
    }
    text += ` ${name}=""`;
  }
  return { text, cursorOffset };
}

function createRuntimePromptOverlayDescriptor(
  workspaceId: string,
  prompt: PromptLibraryEntry
): InvocationDescriptor {
  const shadowedByBuiltin = BUILT_IN_SLASH_COMMAND_NAMES.has(prompt.title);
  const hint = buildPromptArgumentHint(prompt);
  const insert = buildPromptInsertText(prompt, shadowedByBuiltin);
  return withInvocationExecutionPlan({
    id: `session:prompt:${prompt.id}`,
    title: prompt.title,
    summary: prompt.description || prompt.title,
    description: prompt.description || null,
    kind: "session_command",
    source: {
      kind: "session_command",
      contributionType: "session_scoped",
      authority: prompt.scope === "workspace" ? "workspace" : "session",
      label: "Runtime prompt library",
      sourceId: prompt.id,
      workspaceId,
      provenance: {
        promptScope: prompt.scope,
      },
    },
    runtimeTool: null,
    argumentSchema: null,
    aliases: shadowedByBuiltin ? [`/prompts:${prompt.title}`] : [],
    tags: ["prompt_overlay", prompt.scope],
    safety: {
      level: "read",
      readOnly: true,
      destructive: false,
      openWorld: false,
      idempotent: true,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: false,
      requiresReadiness: false,
      hiddenReason: "Prompt-library overlays stay operator-facing in the invocation plane.",
    },
    readiness: toInvocationReadiness({
      state: "ready",
      available: true,
    }),
    metadata: {
      invocationPlane: {
        winningSource: "runtime_prompt_overlay",
      },
      promptOverlay: {
        promptId: prompt.id,
        scope: prompt.scope,
      },
      slashCommand: {
        primaryTrigger: `/${prompt.title}`,
        legacyAliases: shadowedByBuiltin ? [`/prompts:${prompt.title}`] : [],
        insertText: insert.text,
        cursorOffset: insert.cursorOffset ?? null,
        hint,
        shadowedByBuiltin,
      },
    },
  });
}

function sortCatalogEntries(left: InvocationDescriptor, right: InvocationDescriptor): number {
  return left.id.localeCompare(right.id);
}

function summarizeSources(items: InvocationDescriptor[]): ActiveInvocationCatalog["sources"] {
  const counts = new Map<InvocationDescriptor["kind"], number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  const order: InvocationDescriptor["kind"][] = ["runtime_tool", "plugin", "session_command"];
  return order
    .filter((kind) => counts.has(kind))
    .map((kind) => ({ kind, count: counts.get(kind) ?? 0 }));
}

function applyAudienceFilter(
  catalog: ActiveInvocationCatalog,
  audience: InvocationAudience
): ActiveInvocationCatalog {
  const items = catalog.items.filter((item) => {
    const visible =
      audience === "model" ? item.exposure.modelVisible : item.exposure.operatorVisible;
    if (!visible) {
      return false;
    }
    if (item.exposure.requiresReadiness && !item.readiness.available) {
      return false;
    }
    return true;
  });
  return {
    ...catalog,
    items,
    sources: summarizeSources(items),
    execution: summarizeInvocationExecutionCatalog(items),
  };
}

function buildCatalogFingerprint(input: {
  workspaceId: string;
  items: InvocationDescriptor[];
  sources: ActiveInvocationCatalog["sources"];
  execution: ActiveInvocationCatalog["execution"];
}): string {
  return JSON.stringify({
    workspaceId: input.workspaceId,
    sources: input.sources,
    execution: input.execution,
    items: input.items,
  });
}

function getCandidatePrecedence(candidate: InvocationDescriptor): number {
  if (
    candidate.kind === "session_command" &&
    candidate.metadata &&
    "slashCommand" in candidate.metadata
  ) {
    return 25;
  }
  if (candidate.kind === "session_command") {
    return 10;
  }
  if (
    candidate.kind === "runtime_tool" &&
    candidate.source.kind === "runtime_tool" &&
    candidate.source.contributionType === "built_in"
  ) {
    return 400;
  }
  if (candidate.kind === "runtime_tool" && candidate.source.kind === "runtime_extension") {
    return 300;
  }
  if (candidate.kind === "plugin" && candidate.source.kind === "runtime_extension") {
    return 250;
  }
  if (candidate.kind === "plugin" && candidate.source.kind === "live_skill") {
    return 200;
  }
  if (candidate.kind === "plugin" && candidate.source.kind === "workspace_skill_manifest") {
    return 150;
  }
  return 100;
}

function getWinningSourceLabel(candidate: InvocationDescriptor): string {
  if (
    candidate.kind === "session_command" &&
    candidate.metadata &&
    "slashCommand" in candidate.metadata
  ) {
    return "runtime_prompt_overlay";
  }
  if (
    candidate.kind === "runtime_tool" &&
    candidate.source.kind === "runtime_tool" &&
    candidate.source.contributionType === "built_in"
  ) {
    return "built_in_runtime_tool";
  }
  if (candidate.kind === "runtime_tool" && candidate.source.kind === "runtime_extension") {
    return "runtime_extension_tool";
  }
  if (candidate.kind === "plugin" && candidate.source.kind === "runtime_extension") {
    return candidate.metadata?.kernelExtensionBundle
      ? "projection_extension_bundle"
      : "plugin_catalog";
  }
  if (candidate.kind === "plugin") {
    return "plugin_catalog";
  }
  return "session_command";
}

function compareCandidates(
  left: NormalizedCatalogCandidate,
  right: NormalizedCatalogCandidate
): number {
  if (left.precedence !== right.precedence) {
    return right.precedence - left.precedence;
  }
  const leftSource = `${left.descriptor.source.kind}:${left.descriptor.source.sourceId}`;
  const rightSource = `${right.descriptor.source.kind}:${right.descriptor.source.sourceId}`;
  return leftSource.localeCompare(rightSource);
}

function withInvocationPlaneMetadata(
  descriptor: InvocationDescriptor,
  input: {
    winningSource: string;
    shadowed?: Array<{
      id: string;
      sourceKind: InvocationDescriptor["source"]["kind"];
      sourceId: string;
      title: string;
    }>;
  }
): InvocationDescriptor {
  return {
    ...descriptor,
    metadata: {
      ...(descriptor.metadata ?? {}),
      invocationPlane: {
        ...(((descriptor.metadata ?? {}).invocationPlane as Record<string, unknown> | undefined) ??
          {}),
        winningSource: input.winningSource,
        ...(input.shadowed && input.shadowed.length > 0 ? { shadowed: input.shadowed } : {}),
      },
    },
  };
}

function dedupeCatalogEntries(candidates: InvocationDescriptor[]): InvocationDescriptor[] {
  const candidatesById = new Map<string, NormalizedCatalogCandidate[]>();

  for (const descriptor of candidates) {
    const candidate: NormalizedCatalogCandidate = {
      descriptor,
      precedence: getCandidatePrecedence(descriptor),
      winningSource: getWinningSourceLabel(descriptor),
    };
    const existing = candidatesById.get(descriptor.id);
    if (existing) {
      existing.push(candidate);
      continue;
    }
    candidatesById.set(descriptor.id, [candidate]);
  }

  const winners: InvocationDescriptor[] = [];

  for (const group of candidatesById.values()) {
    group.sort(compareCandidates);
    const [winner, ...shadowed] = group;
    winners.push(
      withInvocationPlaneMetadata(winner.descriptor, {
        winningSource: winner.winningSource,
        shadowed: shadowed.map((candidate) => ({
          id: candidate.descriptor.id,
          sourceKind: candidate.descriptor.source.kind,
          sourceId: candidate.descriptor.source.sourceId,
          title: candidate.descriptor.title,
        })),
      })
    );
  }

  return winners.sort(sortCatalogEntries);
}

export function createRuntimeInvocationCatalogFacade(
  input: RuntimeInvocationCatalogInput
): RuntimeInvocationCatalogFacade {
  let cachedFingerprint: string | null = null;
  let cachedCatalog: ActiveInvocationCatalog | null = null;

  const buildCatalog = async (): Promise<ActiveInvocationCatalog> => {
    const capabilityPlugins = await input.pluginCatalog.listPlugins();
    const projection = input.readProjection
      ? await input.readProjection().catch(() => ({
          projectionBacked: false,
          extensionBundles: null,
          capabilities: null,
        }))
      : {
          projectionBacked: false,
          extensionBundles: null,
          capabilities: null,
        };
    const plugins = projection.projectionBacked
      ? mergeRuntimeKernelProjectionPlugins({
          extensionBundles: projection.extensionBundles,
          capabilities: projection.capabilities,
          capabilityPlugins,
        })
      : capabilityPlugins;
    const pluginDescriptors = plugins.map(createPluginInvocationDescriptor);

    const runtimeExtensionToolDescriptors = input.listRuntimeExtensionTools
      ? (
          await Promise.allSettled(
            plugins
              .filter((plugin) => plugin.source === "runtime_extension")
              .map(async (plugin) => {
                const tools = await input.listRuntimeExtensionTools!({
                  workspaceId: input.workspaceId,
                  extensionId: plugin.id,
                });
                return tools.map((tool) =>
                  createRuntimeExtensionToolDescriptor({
                    workspaceId: input.workspaceId,
                    plugin,
                    tool,
                  })
                );
              })
          )
        ).flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      : [];

    const runtimePromptOverlayDescriptors = input.listRuntimePrompts
      ? (
          await Promise.all([
            input.listRuntimePrompts(input.workspaceId).catch(() => []),
            input.listRuntimePrompts(null).catch(() => []),
          ])
        )
          .flat()
          .reduce<PromptLibraryEntry[]>((entries, prompt) => {
            if (entries.some((entry) => entry.id === prompt.id)) {
              return entries;
            }
            entries.push(prompt);
            return entries;
          }, [])
          .map((prompt) => createRuntimePromptOverlayDescriptor(input.workspaceId, prompt))
      : [];

    const items = dedupeCatalogEntries([
      ...BUILT_IN_RUNTIME_TOOLS.map((descriptor) =>
        createBuiltInRuntimeToolDescriptor(input.workspaceId, descriptor)
      ),
      ...pluginDescriptors,
      ...runtimeExtensionToolDescriptors,
      ...runtimePromptOverlayDescriptors,
      ...SESSION_COMMANDS.map((descriptor) =>
        createSessionCommandDescriptor(input.workspaceId, descriptor)
      ),
    ]);

    const sources = summarizeSources(items);
    const execution = summarizeInvocationExecutionCatalog(items);
    const fingerprint = buildCatalogFingerprint({
      workspaceId: input.workspaceId,
      items,
      sources,
      execution,
    });

    if (cachedCatalog && cachedFingerprint === fingerprint) {
      return cachedCatalog;
    }

    const nextCatalog = {
      catalogId: `workspace:${input.workspaceId}`,
      workspaceId: input.workspaceId,
      revision: (cachedCatalog?.revision ?? 0) + 1,
      generatedAt: Date.now(),
      items,
      sources,
      execution,
    };

    cachedCatalog = nextCatalog;
    cachedFingerprint = fingerprint;

    return nextCatalog;
  };

  return {
    readActiveCatalog: buildCatalog,
    publishActiveCatalog: async ({ audience = "operator" } = {}) =>
      applyAudienceFilter(await buildCatalog(), audience),
    searchActiveCatalog: async (query, { audience = "operator" } = {}) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return [];
      }
      const catalog = await applyAudienceFilter(await buildCatalog(), audience);
      return catalog.items.filter((item) => {
        const haystacks = [
          item.id,
          item.title,
          item.summary,
          item.description ?? "",
          ...item.aliases,
          ...item.tags,
        ];
        return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
      });
    },
    getInvocationDescriptor: async (id, { audience = "operator" } = {}) => {
      const catalog = await applyAudienceFilter(await buildCatalog(), audience);
      return catalog.items.find((item) => item.id === id) ?? null;
    },
    resolveInvocationDescriptor: async (id) => {
      const catalog = await buildCatalog();
      return catalog.items.find((item) => item.id === id) ?? null;
    },
  };
}
