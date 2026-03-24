import { useEffect, useMemo, useState } from "react";
import type {
  RuntimeContextSelectionPolicyV2,
  RuntimeRunPrepareV2Request,
} from "@ku0/code-runtime-host-contract";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { recordSentryMetric } from "../../../features/shared/sentry";
import type { AgentIntentState, WebMcpActiveModelContext } from "../types/webMcpBridge";
import { prepareRuntimeRunV2 } from "../ports/tauriRuntimeJobs";
import { buildAgentTaskMissionBrief } from "./runtimeMissionDraftFacade";

type RuntimeWebMcpContextPolicyInput = {
  workspaceId: string;
  intent: AgentIntentState;
  activeModelContext?: WebMcpActiveModelContext | null;
  enabled?: boolean;
};

export type RuntimeWebMcpContextPolicyState = {
  selectionPolicy: RuntimeContextSelectionPolicyV2 | null;
  contextFingerprint: string | null;
  loading: boolean;
  error: string | null;
  truthSourceLabel: string | null;
};

type RuntimeWebMcpContextPolicyResolution = {
  selectionPolicy: RuntimeContextSelectionPolicyV2;
  contextFingerprint: string;
  truthSourceLabel: string;
  result: "cache" | "runtime";
};

const WEBMCP_CONTEXT_POLICY_CACHE_LIMIT = 16;

const runtimeWebMcpContextPolicyCache = new Map<string, RuntimeWebMcpContextPolicyResolution>();
const runtimeWebMcpContextPolicyInflight = new Map<
  string,
  Promise<RuntimeWebMcpContextPolicyResolution>
>();

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildIntentContextHints(intent: AgentIntentState): string[] {
  return [
    readOptionalText(intent.constraints)
      ? `Constraints: ${readOptionalText(intent.constraints)}`
      : null,
    readOptionalText(intent.successCriteria)
      ? `Success criteria: ${readOptionalText(intent.successCriteria)}`
      : null,
    readOptionalText(intent.managerNotes)
      ? `Manager notes: ${readOptionalText(intent.managerNotes)}`
      : null,
    readOptionalText(intent.deadline) ? `Deadline: ${readOptionalText(intent.deadline)}` : null,
    `Priority: ${intent.priority}`,
  ].filter((entry): entry is string => Boolean(entry));
}

export function buildRuntimeWebMcpContextPrepareRequest(
  input: RuntimeWebMcpContextPolicyInput
): RuntimeRunPrepareV2Request | null {
  const objective = readOptionalText(input.intent.objective);
  if (!objective) {
    return null;
  }

  const title = truncateText(objective, 80);
  const contextHints = buildIntentContextHints(input.intent);

  return {
    workspaceId: input.workspaceId,
    title,
    taskSource: {
      kind: "manual",
      title,
    },
    ...(input.activeModelContext?.provider ? { provider: input.activeModelContext.provider } : {}),
    ...(readOptionalText(input.activeModelContext?.modelId)
      ? { modelId: readOptionalText(input.activeModelContext?.modelId) }
      : {}),
    accessMode: "on-request",
    executionMode: "single",
    missionBrief: buildAgentTaskMissionBrief({
      objective,
      accessMode: "on-request",
    }),
    steps: [
      {
        kind: "read",
        input: objective,
      },
      ...contextHints.map((hint) => ({
        kind: "read" as const,
        input: hint,
      })),
    ],
  };
}

function buildRuntimeWebMcpContextPolicyCacheKey(request: RuntimeRunPrepareV2Request): string {
  return JSON.stringify(request);
}

function touchRuntimeWebMcpContextPolicyCacheEntry(
  cacheKey: string,
  entry: RuntimeWebMcpContextPolicyResolution
): void {
  runtimeWebMcpContextPolicyCache.delete(cacheKey);
  runtimeWebMcpContextPolicyCache.set(cacheKey, entry);
  while (runtimeWebMcpContextPolicyCache.size > WEBMCP_CONTEXT_POLICY_CACHE_LIMIT) {
    const oldestKey = runtimeWebMcpContextPolicyCache.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    runtimeWebMcpContextPolicyCache.delete(oldestKey);
  }
}

async function resolveRuntimeWebMcpContextPolicy(
  request: RuntimeRunPrepareV2Request,
  cacheKey: string
): Promise<RuntimeWebMcpContextPolicyResolution> {
  const cached = runtimeWebMcpContextPolicyCache.get(cacheKey);
  if (cached) {
    touchRuntimeWebMcpContextPolicyCacheEntry(cacheKey, cached);
    return {
      ...cached,
      truthSourceLabel: "Runtime kernel v2 prepare (cached)",
      result: "cache",
    };
  }

  const inflight = runtimeWebMcpContextPolicyInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const nextRequest = prepareRuntimeRunV2(request)
    .then((preparation) => {
      const resolution = {
        selectionPolicy: preparation.contextWorkingSet.selectionPolicy,
        contextFingerprint: preparation.contextWorkingSet.contextFingerprint,
        truthSourceLabel: "Runtime kernel v2 prepare",
        result: "runtime" as const,
      };
      touchRuntimeWebMcpContextPolicyCacheEntry(cacheKey, resolution);
      return resolution;
    })
    .finally(() => {
      runtimeWebMcpContextPolicyInflight.delete(cacheKey);
    });

  runtimeWebMcpContextPolicyInflight.set(cacheKey, nextRequest);
  return nextRequest;
}

export function __resetRuntimeWebMcpContextPolicyCacheForTests(): void {
  runtimeWebMcpContextPolicyCache.clear();
  runtimeWebMcpContextPolicyInflight.clear();
}

export function useRuntimeWebMcpContextPolicy(
  input: RuntimeWebMcpContextPolicyInput
): RuntimeWebMcpContextPolicyState {
  const request = useMemo(
    () => buildRuntimeWebMcpContextPrepareRequest(input),
    [
      input.activeModelContext?.modelId,
      input.activeModelContext?.provider,
      input.intent,
      input.workspaceId,
    ]
  );
  const debouncedRequest = useDebouncedValue(request, 250);
  const requestCacheKey = useMemo(
    () => (debouncedRequest ? buildRuntimeWebMcpContextPolicyCacheKey(debouncedRequest) : null),
    [debouncedRequest]
  );
  const [selectionPolicy, setSelectionPolicy] = useState<RuntimeContextSelectionPolicyV2 | null>(
    null
  );
  const [contextFingerprint, setContextFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truthSourceLabel, setTruthSourceLabel] = useState<string | null>(null);
  const policyEnabled = input.enabled ?? true;

  useEffect(() => {
    if (!policyEnabled || !debouncedRequest || !requestCacheKey) {
      setSelectionPolicy(null);
      setContextFingerprint(null);
      setLoading(false);
      setError(null);
      setTruthSourceLabel(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void resolveRuntimeWebMcpContextPolicy(debouncedRequest, requestCacheKey)
      .then((resolution) => {
        if (cancelled) {
          return;
        }
        setSelectionPolicy(resolution.selectionPolicy);
        setContextFingerprint(resolution.contextFingerprint);
        setError(null);
        setTruthSourceLabel(resolution.truthSourceLabel);
        recordSentryMetric("runtime_webmcp_context_policy", 1, {
          attributes: {
            workspace_id: input.workspaceId,
            result: resolution.result,
            provider: input.activeModelContext?.provider ?? "unknown",
            model_id: readOptionalText(input.activeModelContext?.modelId) ?? "unknown",
            strategy: resolution.selectionPolicy.strategy,
            tool_profile: resolution.selectionPolicy.toolExposureProfile,
          },
        });
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setSelectionPolicy(null);
        setContextFingerprint(null);
        setTruthSourceLabel(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
        recordSentryMetric("runtime_webmcp_context_policy", 1, {
          attributes: {
            workspace_id: input.workspaceId,
            result: "fallback",
            provider: input.activeModelContext?.provider ?? "unknown",
            model_id: readOptionalText(input.activeModelContext?.modelId) ?? "unknown",
          },
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedRequest,
    input.activeModelContext?.modelId,
    input.activeModelContext?.provider,
    input.workspaceId,
    policyEnabled,
    requestCacheKey,
  ]);

  return {
    selectionPolicy,
    contextFingerprint,
    loading,
    error,
    truthSourceLabel,
  };
}
