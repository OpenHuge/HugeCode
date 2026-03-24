import type { AgentCommandCenterSnapshot, WebMcpActiveModelContext } from "./webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type WebMcpResourceContent = {
  uri: string;
  mimeType?: string;
  text?: string;
};

export type WebMcpResourceDescriptor = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  read: (
    uri: URL,
    params?: Record<string, string>
  ) => Promise<{ contents: WebMcpResourceContent[] }>;
};

export type WebMcpPromptMessage = {
  role: "user" | "assistant";
  content:
    | { type: "text"; text: string }
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            data: string;
            mimeType: string;
          }
      >;
};

export type WebMcpPromptDescriptor = {
  name: string;
  description?: string;
  argsSchema?: JsonRecord;
  get: (args: Record<string, unknown>) => Promise<{ messages: WebMcpPromptMessage[] }>;
};

export type WebMcpContextDescriptorOptions = {
  activeModelContext?: WebMcpActiveModelContext | null;
  toolExposureDecision?: {
    provider: string | null;
    mode: "minimal" | "full" | "slim";
    visibleToolNames: string[];
    hiddenToolNames: string[];
    reasonCodes: string[];
  } | null;
  runtimeToolNames?: readonly string[];
};

function asJsonText(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function buildWebMcpResources(
  snapshot: AgentCommandCenterSnapshot,
  options?: WebMcpContextDescriptorOptions
): WebMcpResourceDescriptor[] {
  const baseUri = `hypecode://workspace/${encodeURIComponent(snapshot.workspaceId)}`;
  const runtimeDiscoveryResource = buildRuntimeToolDiscoveryResource(baseUri, options);

  return [
    {
      uri: `${baseUri}/overview`,
      name: "workspace-overview",
      description: "Current workspace intent and health summary.",
      mimeType: "application/json",
      read: async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: asJsonText({
              workspaceId: snapshot.workspaceId,
              workspaceName: snapshot.workspaceName,
              updatedAt: snapshot.updatedAt,
              localProjectBoardRemoved: true,
              intent: snapshot.intent,
            }),
          },
        ],
      }),
    },
    ...(runtimeDiscoveryResource ? [runtimeDiscoveryResource] : []),
  ];
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildRuntimeToolDiscoveryResource(
  baseUri: string,
  options?: WebMcpContextDescriptorOptions
): WebMcpResourceDescriptor | null {
  const discoveryContext = buildRuntimeToolDiscoveryContext(options);
  if (!discoveryContext) {
    return null;
  }

  return {
    uri: `${baseUri}/runtime-tool-discovery`,
    name: "runtime-tool-discovery",
    description: "Provider-aware runtime discovery guide for reduced tool catalogs.",
    mimeType: "application/json",
    read: async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: asJsonText(discoveryContext),
        },
      ],
    }),
  };
}

function buildRuntimeToolDiscoveryContext(
  options?: WebMcpContextDescriptorOptions
): JsonRecord | null {
  if (options?.toolExposureDecision?.mode !== "slim") {
    if (options?.toolExposureDecision?.mode !== "minimal") {
      return null;
    }
  }

  const runtimeToolNames = new Set(options.runtimeToolNames ?? []);
  const directRuntimeToolNames = options.toolExposureDecision.visibleToolNames.filter((toolName) =>
    runtimeToolNames.has(toolName)
  );

  return {
    provider: options.toolExposureDecision.provider,
    modelId: options.activeModelContext?.modelId ?? null,
    catalogMode: options.toolExposureDecision.mode,
    deferredRuntimeToolCount: options.toolExposureDecision.hiddenToolNames.length,
    directRuntimeToolCount: directRuntimeToolNames.length,
    directRuntimeToolNames,
    preferredDiscoverySequence: directRuntimeToolNames.filter((toolName) =>
      [
        "get-runtime-capabilities-summary",
        "list-runtime-live-skills",
        "search-workspace-files",
        "list-workspace-tree",
        "read-workspace-file",
        "run-runtime-live-skill",
        "start-runtime-run",
      ].includes(toolName)
    ),
    guidance: [
      "Prefer search, tree, and read tools before any write-capable workspace tool.",
      "Use get-runtime-capabilities-summary and list-runtime-live-skills to discover supported runtime actions before escalating.",
      "Use run-runtime-live-skill for bounded operations and start-runtime-run or sub-agent sessions for multi-step execution.",
      "Treat deferred runtime tools as unavailable in the current session unless the catalog is re-synced with a broader policy.",
    ],
    reasonCodes: options.toolExposureDecision.reasonCodes,
  };
}

export function buildWebMcpPrompts(
  snapshot: AgentCommandCenterSnapshot,
  options?: WebMcpContextDescriptorOptions
): WebMcpPromptDescriptor[] {
  const runtimeDiscoveryPrompt = buildRuntimeToolDiscoveryPrompt(options);

  return [
    {
      name: "summarize-workspace-status",
      description: "Summarize current intent and runtime-backed orchestration posture.",
      argsSchema: {
        type: "object",
        properties: {
          audience: { type: "string", description: "Target audience for the summary." },
        },
      },
      get: async (args) => {
        const audience = coerceString(args.audience) ?? "engineering manager";
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: [
                  `Summarize workspace ${snapshot.workspaceName} for ${audience}.`,
                  `Objective: ${snapshot.intent.objective || "(not set)"}`,
                  `Constraints: ${snapshot.intent.constraints || "(not set)"}`,
                  `Success criteria: ${snapshot.intent.successCriteria || "(not set)"}`,
                  "Local project-task board, governance automation, and audit log are not part of the active command-center surface.",
                  "Use runtime-backed orchestration state and runtime tools for execution truth.",
                ].join("\n"),
              },
            },
          ],
        };
      },
    },
    ...(runtimeDiscoveryPrompt ? [runtimeDiscoveryPrompt] : []),
  ];
}

function buildRuntimeToolDiscoveryPrompt(
  options?: WebMcpContextDescriptorOptions
): WebMcpPromptDescriptor | null {
  const discoveryContext = buildRuntimeToolDiscoveryContext(options);
  if (!discoveryContext) {
    return null;
  }

  return {
    name: "choose-runtime-tooling-strategy",
    description: "Choose the best runtime entrypoint when the runtime uses a reduced tool catalog.",
    argsSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task the model is trying to complete." },
      },
    },
    get: async (args) => {
      const task = coerceString(args.task) ?? "Complete the current workspace task safely.";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Choose the best runtime strategy for: ${task}`,
                `Provider: ${String(discoveryContext.provider)}`,
                `Model: ${String(discoveryContext.modelId ?? "(unknown)")}`,
                `Catalog mode: ${String(discoveryContext.catalogMode)}`,
                `Direct runtime tools: ${asJsonText(discoveryContext.directRuntimeToolNames)}`,
                "Preferred discovery sequence:",
                ...(Array.isArray(discoveryContext.preferredDiscoverySequence)
                  ? discoveryContext.preferredDiscoverySequence.map((step) => `- ${String(step)}`)
                  : []),
                "Guidance:",
                ...(Array.isArray(discoveryContext.guidance)
                  ? discoveryContext.guidance.map((entry) => `- ${String(entry)}`)
                  : []),
              ].join("\n"),
            },
          },
        ],
      };
    },
  };
}
