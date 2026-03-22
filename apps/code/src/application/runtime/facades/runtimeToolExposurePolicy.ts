import {
  normalizeRuntimeExecutionProvider,
  type RuntimeExecutionProvider,
} from "./runtimeToolExecutionPolicy";

export type RuntimeToolExposurePolicyReasonCode =
  | "provider-prefers-slim-tool-catalog"
  | "provider-keeps-full-tool-catalog";

export type RuntimeToolExposurePolicyDecision = {
  provider: RuntimeExecutionProvider;
  mode: "full" | "slim";
  visibleToolNames: string[];
  hiddenToolNames: string[];
  reasonCodes: RuntimeToolExposurePolicyReasonCode[];
};

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
  toolNames: string[];
  runtimeToolNames?: readonly string[];
}): RuntimeToolExposurePolicyDecision {
  const provider = normalizeRuntimeExecutionProvider({
    provider: input.provider,
    modelId: input.modelId,
  });
  const runtimeToolNames = new Set(input.runtimeToolNames ?? []);

  if (provider !== "anthropic") {
    return {
      provider,
      mode: "full",
      visibleToolNames: [...input.toolNames],
      hiddenToolNames: [],
      reasonCodes: ["provider-keeps-full-tool-catalog"],
    };
  }

  const visibleToolNames: string[] = [];
  const hiddenToolNames: string[] = [];

  for (const toolName of input.toolNames) {
    if (runtimeToolNames.has(toolName) && !ANTHROPIC_RUNTIME_INITIAL_TOOL_NAMES.has(toolName)) {
      hiddenToolNames.push(toolName);
      continue;
    }
    visibleToolNames.push(toolName);
  }

  return {
    provider,
    mode: hiddenToolNames.length > 0 ? "slim" : "full",
    visibleToolNames,
    hiddenToolNames,
    reasonCodes: [
      hiddenToolNames.length > 0
        ? "provider-prefers-slim-tool-catalog"
        : "provider-keeps-full-tool-catalog",
    ],
  };
}
