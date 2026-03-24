import { useEffect, useMemo, useState } from "react";
import type {
  RuntimeContextSelectionPolicyV2,
  RuntimeRunPrepareV2Request,
} from "@ku0/code-runtime-host-contract";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { AgentIntentState } from "../types/webMcpBridge";
import { prepareRuntimeRunV2 } from "../ports/tauriRuntimeJobs";
import { buildAgentTaskMissionBrief } from "./runtimeMissionDraftFacade";

type RuntimeWebMcpContextPolicyInput = {
  workspaceId: string;
  intent: AgentIntentState;
  enabled?: boolean;
};

export type RuntimeWebMcpContextPolicyState = {
  selectionPolicy: RuntimeContextSelectionPolicyV2 | null;
  contextFingerprint: string | null;
  loading: boolean;
  error: string | null;
  truthSourceLabel: string | null;
};

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

export function useRuntimeWebMcpContextPolicy(
  input: RuntimeWebMcpContextPolicyInput
): RuntimeWebMcpContextPolicyState {
  const request = useMemo(
    () => buildRuntimeWebMcpContextPrepareRequest(input),
    [input.intent, input.workspaceId]
  );
  const debouncedRequest = useDebouncedValue(request, 250);
  const [selectionPolicy, setSelectionPolicy] = useState<RuntimeContextSelectionPolicyV2 | null>(
    null
  );
  const [contextFingerprint, setContextFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const policyEnabled = input.enabled ?? true;

  useEffect(() => {
    if (!policyEnabled || !debouncedRequest) {
      setSelectionPolicy(null);
      setContextFingerprint(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void prepareRuntimeRunV2(debouncedRequest)
      .then((preparation) => {
        if (cancelled) {
          return;
        }
        setSelectionPolicy(preparation.contextWorkingSet.selectionPolicy ?? null);
        setContextFingerprint(preparation.contextWorkingSet.contextFingerprint ?? null);
        setError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setSelectionPolicy(null);
        setContextFingerprint(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedRequest, policyEnabled]);

  return {
    selectionPolicy,
    contextFingerprint,
    loading,
    error,
    truthSourceLabel: selectionPolicy ? "Runtime kernel v2 prepare" : null,
  };
}
