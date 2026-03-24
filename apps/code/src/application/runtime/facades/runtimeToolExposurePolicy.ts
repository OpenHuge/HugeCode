import {
  normalizeRuntimeExecutionProvider,
  type RuntimeExecutionProvider,
} from "./runtimeToolExecutionPolicy";

export type RuntimeToolExposurePolicyReasonCode =
  | "runtime-prefers-minimal-tool-catalog"
  | "runtime-prefers-slim-tool-catalog"
  | "runtime-keeps-full-tool-catalog"
  | "provider-prefers-slim-tool-catalog"
  | "provider-keeps-full-tool-catalog";

export type RuntimeToolExposurePolicyDecision = {
  provider: RuntimeExecutionProvider;
  mode: "minimal" | "full" | "slim";
  visibleToolNames: string[];
  hiddenToolNames: string[];
  reasonCodes: RuntimeToolExposurePolicyReasonCode[];
};

const MINIMAL_RUNTIME_INITIAL_TOOL_NAMES = new Set<string>([
  "list-runtime-runs",
  "get-runtime-run-status",
  "list-runtime-live-skills",
  "get-runtime-capabilities-summary",
  "get-runtime-health",
  "inspect-workspace-diagnostics",
  "search-workspace-files",
  "list-workspace-tree",
  "read-workspace-file",
  "run-runtime-live-skill",
  "start-runtime-run",
]);

const ANTHROPIC_RUNTIME_INITIAL_TOOL_NAMES = new Set<string>([
  "list-runtime-runs",
  "get-runtime-run-status",
  "list-runtime-live-skills",
  "get-runtime-capabilities-summary",
  "get-runtime-health",
  "inspect-workspace-diagnostics",
  "list-runtime-git-branches",
  "get-runtime-git-status",
  "get-runtime-git-diffs",
  "search-workspace-files",
  "list-workspace-tree",
  "read-workspace-file",
  "write-workspace-file",
  "edit-workspace-file",
  "apply-workspace-patch",
  "execute-workspace-command",
  "query-network-analysis",
  "run-runtime-live-skill",
  "start-runtime-run",
  "orchestrate-runtime-sub-agent-batch",
  "spawn-runtime-sub-agent-session",
  "send-runtime-sub-agent-instruction",
  "wait-runtime-sub-agent-session",
  "get-runtime-sub-agent-session-status",
  "interrupt-runtime-sub-agent-session",
  "close-runtime-sub-agent-session",
  "list-runtime-action-required",
  "get-runtime-action-required",
  "resolve-runtime-action-required",
]);

export function resolveRuntimeToolExposurePolicy(input: {
  provider?: string | null;
  modelId?: string | null;
  toolExposureProfile?: "minimal" | "slim" | "full" | null;
  toolNames: string[];
  runtimeToolNames?: readonly string[];
}): RuntimeToolExposurePolicyDecision {
  const provider = normalizeRuntimeExecutionProvider({
    provider: input.provider,
    modelId: input.modelId,
  });
  const runtimeToolNames = new Set(input.runtimeToolNames ?? []);
  const explicitProfile = input.toolExposureProfile ?? null;

  if (explicitProfile === "full") {
    return {
      provider,
      mode: "full",
      visibleToolNames: [...input.toolNames],
      hiddenToolNames: [],
      reasonCodes: ["runtime-keeps-full-tool-catalog"],
    };
  }

  const visibleToolNames: string[] = [];
  const hiddenToolNames: string[] = [];
  const allowedRuntimeTools =
    explicitProfile === "minimal"
      ? MINIMAL_RUNTIME_INITIAL_TOOL_NAMES
      : explicitProfile === "slim" || provider === "anthropic"
        ? ANTHROPIC_RUNTIME_INITIAL_TOOL_NAMES
        : null;

  if (!allowedRuntimeTools) {
    return {
      provider,
      mode: "full",
      visibleToolNames: [...input.toolNames],
      hiddenToolNames: [],
      reasonCodes: ["provider-keeps-full-tool-catalog"],
    };
  }

  for (const toolName of input.toolNames) {
    if (runtimeToolNames.has(toolName) && !allowedRuntimeTools.has(toolName)) {
      hiddenToolNames.push(toolName);
      continue;
    }
    visibleToolNames.push(toolName);
  }

  const mode =
    explicitProfile === "minimal" ? "minimal" : hiddenToolNames.length > 0 ? "slim" : "full";
  const reasonCode =
    explicitProfile === "minimal"
      ? "runtime-prefers-minimal-tool-catalog"
      : explicitProfile === "slim"
        ? hiddenToolNames.length > 0
          ? "runtime-prefers-slim-tool-catalog"
          : "runtime-keeps-full-tool-catalog"
        : hiddenToolNames.length > 0
          ? "provider-prefers-slim-tool-catalog"
          : "provider-keeps-full-tool-catalog";

  return {
    provider,
    mode,
    visibleToolNames,
    hiddenToolNames,
    reasonCodes: [reasonCode],
  };
}
