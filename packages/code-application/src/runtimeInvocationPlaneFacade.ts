import type {
  InvocationAudience,
  InvocationDescriptor,
  InvocationExecutionBinding,
  InvocationExecutionEvidence,
  InvocationExecutionOutcome,
  InvocationExecutionPlan,
  InvocationExecutionPreflightState,
  InvocationReadiness,
  InvocationReadinessState,
  RuntimeInvocationDispatchResponse,
  RuntimeInvocationDispatchStatus,
  RuntimeInvocationHostCategory,
  RuntimeInvocationHostDescriptor,
  RuntimeInvocationHostDispatchMode,
  RuntimeInvocationHostReadinessState,
  RuntimeInvocationHostRegistry,
} from "@ku0/code-runtime-host-contract";
import {
  buildInvocationExecutionEvidence,
  buildInvocationExecutionPlan,
} from "./runtimeInvocationExecution";
import { readRuntimeInvocationPromptOverlayMetadata } from "./runtimeInvocationCatalog";

export type RuntimeInvocationFallbackClassification =
  | "runtime-canonical"
  | "compat-fallback"
  | "resolve-only";

export type RuntimeInvocationHostSelectionSummary = {
  binding: InvocationExecutionBinding;
  candidateCategories: RuntimeInvocationHostCategory[];
  candidateHosts: RuntimeInvocationHostDescriptor[];
  selectedHost: RuntimeInvocationHostDescriptor | null;
  dispatchMode: RuntimeInvocationHostDispatchMode | null;
  summary: string;
};

export type RuntimeInvocationDispatchProvenanceSummary = {
  invocationId: string;
  status: RuntimeInvocationDispatchStatus;
  summary: string;
  hostId: string;
  category: RuntimeInvocationHostCategory;
  registryVersion: string;
  workspaceId: string | null;
  caller: InvocationAudience;
  preflightState: InvocationExecutionPreflightState;
  preflightReason: string | null;
  postExecutionApplied: boolean;
  postExecutionSummary: string;
  postExecutionMetadata: Record<string, unknown> | null;
};

export type RuntimeInvocationPlaneFacadeResult = {
  caller: InvocationAudience;
  workspaceId: string | null;
  execution: InvocationExecutionPlan;
  hostSelection: RuntimeInvocationHostSelectionSummary;
  dispatchProvenance: RuntimeInvocationDispatchProvenanceSummary | null;
  fallbackClassification: RuntimeInvocationFallbackClassification;
  reconciledReadiness: InvocationReadiness;
  outcome: InvocationExecutionOutcome | null;
  evidence: InvocationExecutionEvidence | null;
};

export type ResolveRuntimeInvocationPlaneFacadeInput = {
  descriptor: InvocationDescriptor;
  runtimeHostRegistry?: RuntimeInvocationHostRegistry | null;
  runtimeDispatchResponse?: RuntimeInvocationDispatchResponse | null;
  caller?: InvocationAudience | null;
  workspaceId?: string | null;
};

const BINDING_CATEGORY_MAP: Record<
  InvocationExecutionBinding["kind"],
  RuntimeInvocationHostCategory[]
> = {
  runtime_run: ["built_in_runtime_tool"],
  runtime_live_skill: ["workspace_skill"],
  runtime_extension_tool: ["runtime_extension_tool"],
  session_message: [],
  approval_response: [],
  prompt_overlay: [],
  unsupported: [],
};

const READINESS_PRIORITY: Record<InvocationReadinessState, number> = {
  blocked: 0,
  unsupported: 1,
  attention: 2,
  ready: 3,
};

const HOST_READINESS_TO_INVOCATION_READINESS: Record<
  RuntimeInvocationHostReadinessState,
  InvocationReadinessState
> = {
  ready: "ready",
  attention: "attention",
  blocked: "blocked",
  unsupported: "unsupported",
};

const DISPATCH_STATUS_TO_OUTCOME_STATUS: Record<
  RuntimeInvocationDispatchStatus,
  InvocationExecutionOutcome["status"]
> = {
  accepted: "executed",
  resolved: "resolved",
  blocked: "blocked",
  unsupported: "unsupported",
};

function cloneReadiness(readiness: InvocationReadiness): InvocationReadiness {
  return {
    ...readiness,
    warnings: [...readiness.warnings],
  };
}

function compareReadinessStates(
  left: InvocationReadinessState,
  right: InvocationReadinessState
): InvocationReadinessState {
  return READINESS_PRIORITY[left] <= READINESS_PRIORITY[right] ? left : right;
}

function isResolveOnlyBinding(binding: InvocationExecutionBinding): boolean {
  return (
    binding.kind === "prompt_overlay" ||
    binding.kind === "session_message" ||
    binding.kind === "approval_response"
  );
}

function describeResolveOnlyBinding(
  descriptor: InvocationDescriptor,
  binding: InvocationExecutionBinding
): string {
  if (binding.kind === "prompt_overlay") {
    const promptOverlay = readRuntimeInvocationPromptOverlayMetadata(descriptor.metadata);
    const promptLabel = promptOverlay?.promptId ? ` \`${promptOverlay.promptId}\`` : "";
    return `Prompt overlay${promptLabel} resolves through the shared prompt/session facade and does not require a runtime host registry entry.`;
  }

  if (binding.kind === "session_message") {
    return "This invocation resolves through the shared prompt/session facade and does not require a runtime host registry entry.";
  }

  if (binding.kind === "approval_response") {
    return "Approval responses resolve through the shared prompt/session facade and do not require a runtime host registry entry.";
  }

  return "This invocation resolves through the shared prompt/session facade and does not require a runtime host registry entry.";
}

function resolveDispatchTerminalReadiness(
  dispatch: RuntimeInvocationDispatchResponse | null | undefined
): {
  state: InvocationReadinessState;
  reason: string;
} | null {
  if (!dispatch) {
    return null;
  }

  if (dispatch.status === "blocked") {
    return {
      state: "blocked",
      reason: dispatch.preflight.reason ?? dispatch.summary,
    };
  }

  if (dispatch.status === "unsupported") {
    return {
      state: "unsupported",
      reason: dispatch.preflight.reason ?? dispatch.summary,
    };
  }

  if (dispatch.preflight.state === "blocked") {
    return {
      state: "blocked",
      reason: dispatch.preflight.reason ?? dispatch.summary,
    };
  }

  return null;
}

function resolvePlaneFacadeCaller(
  input: ResolveRuntimeInvocationPlaneFacadeInput
): InvocationAudience {
  return input.runtimeDispatchResponse
    ? input.runtimeDispatchResponse.provenance.caller
    : (input.caller ?? "operator");
}

function resolvePlaneFacadeWorkspaceId(
  input: ResolveRuntimeInvocationPlaneFacadeInput
): string | null {
  return input.runtimeDispatchResponse
    ? input.runtimeDispatchResponse.provenance.workspaceId
    : (input.workspaceId ??
        input.runtimeHostRegistry?.workspaceId ??
        input.descriptor.source.workspaceId);
}

function compareDispatchMode(
  left: RuntimeInvocationHostDispatchMode,
  right: RuntimeInvocationHostDispatchMode
): number {
  const order: Record<RuntimeInvocationHostDispatchMode, number> = {
    execute: 0,
    resolve_only: 1,
    reserved: 2,
    unsupported: 3,
  };
  return order[left] - order[right];
}

function compareHostReadiness(
  left: RuntimeInvocationHostReadinessState,
  right: RuntimeInvocationHostReadinessState
): number {
  const order: Record<RuntimeInvocationHostReadinessState, number> = {
    ready: 0,
    attention: 1,
    blocked: 2,
    unsupported: 3,
  };
  return order[left] - order[right];
}

function selectCandidateHost(input: {
  candidateHosts: RuntimeInvocationHostDescriptor[];
  runtimeDispatchResponse?: RuntimeInvocationDispatchResponse | null;
}): RuntimeInvocationHostDescriptor | null {
  const dispatchedHostId = input.runtimeDispatchResponse?.provenance.hostId;
  if (dispatchedHostId) {
    const matched = input.candidateHosts.find((host) => host.hostId === dispatchedHostId);
    if (matched) {
      return matched;
    }
  }

  return (
    [...input.candidateHosts].sort((left, right) => {
      const dispatchModeComparison = compareDispatchMode(left.dispatchMode, right.dispatchMode);
      if (dispatchModeComparison !== 0) {
        return dispatchModeComparison;
      }
      const readinessComparison = compareHostReadiness(left.readiness.state, right.readiness.state);
      if (readinessComparison !== 0) {
        return readinessComparison;
      }
      return left.label.localeCompare(right.label);
    })[0] ?? null
  );
}

export function resolveRuntimeInvocationCandidateHostCategories(
  descriptor: InvocationDescriptor
): RuntimeInvocationHostCategory[] {
  const execution = descriptor.execution ?? buildInvocationExecutionPlan(descriptor);
  return [...BINDING_CATEGORY_MAP[execution.binding.kind]];
}

export function resolveRuntimeInvocationHostSelectionSummary(input: {
  descriptor: InvocationDescriptor;
  runtimeHostRegistry?: RuntimeInvocationHostRegistry | null;
  runtimeDispatchResponse?: RuntimeInvocationDispatchResponse | null;
}): RuntimeInvocationHostSelectionSummary {
  const execution = input.descriptor.execution ?? buildInvocationExecutionPlan(input.descriptor);
  const candidateCategories = resolveRuntimeInvocationCandidateHostCategories(input.descriptor);

  if (isResolveOnlyBinding(execution.binding)) {
    return {
      binding: { ...execution.binding },
      candidateCategories,
      candidateHosts: [],
      selectedHost: null,
      dispatchMode: "resolve_only",
      summary: describeResolveOnlyBinding(input.descriptor, execution.binding),
    };
  }

  const candidateHosts =
    input.runtimeHostRegistry?.hosts.filter((host) =>
      candidateCategories.includes(host.category)
    ) ?? [];
  const selectedHost = selectCandidateHost({
    candidateHosts,
    runtimeDispatchResponse: input.runtimeDispatchResponse,
  });
  const dispatchMode = selectedHost?.dispatchMode ?? null;

  if (input.runtimeDispatchResponse && !selectedHost) {
    return {
      binding: { ...execution.binding },
      candidateCategories,
      candidateHosts: candidateHosts.map(cloneHostDescriptor),
      selectedHost: null,
      dispatchMode,
      summary: `Runtime dispatch selected host \`${input.runtimeDispatchResponse.provenance.hostId}\`, but it is missing from the provided host registry snapshot.`,
    };
  }

  if (selectedHost) {
    return {
      binding: { ...execution.binding },
      candidateCategories,
      candidateHosts: candidateHosts.map(cloneHostDescriptor),
      selectedHost: cloneHostDescriptor(selectedHost),
      dispatchMode,
      summary: `Selected runtime host \`${selectedHost.label}\` (${selectedHost.category}) for binding \`${execution.binding.kind}\`.`,
    };
  }

  return {
    binding: { ...execution.binding },
    candidateCategories,
    candidateHosts: candidateHosts.map(cloneHostDescriptor),
    selectedHost: null,
    dispatchMode,
    summary:
      candidateCategories.length === 0
        ? `Invocation binding \`${execution.binding.kind}\` does not map to a known runtime host category.`
        : `No runtime host matched categories ${candidateCategories.join(", ")} for binding \`${execution.binding.kind}\`.`,
  };
}

function cloneHostDescriptor(
  host: RuntimeInvocationHostDescriptor
): RuntimeInvocationHostDescriptor {
  return {
    ...host,
    readiness: { ...host.readiness },
    requirementKeys: [...host.requirementKeys],
    dispatchMethods: [...host.dispatchMethods],
    provenance: { ...host.provenance },
  };
}

export function reconcileRuntimeInvocationDescriptorReadiness(input: {
  descriptor: InvocationDescriptor;
  hostSelectionSummary?: RuntimeInvocationHostSelectionSummary | null;
  runtimeDispatchResponse?: RuntimeInvocationDispatchResponse | null;
}): InvocationReadiness {
  const reconciled = cloneReadiness(input.descriptor.readiness);
  const selectedHost = input.hostSelectionSummary?.selectedHost ?? null;
  const binding = (input.descriptor.execution ?? buildInvocationExecutionPlan(input.descriptor))
    .binding;
  const dispatch = input.runtimeDispatchResponse;
  const terminalDispatchReadiness = resolveDispatchTerminalReadiness(dispatch);

  if (terminalDispatchReadiness) {
    reconciled.available = false;
    reconciled.state = compareReadinessStates(reconciled.state, terminalDispatchReadiness.state);
    reconciled.reason = terminalDispatchReadiness.reason;
    return reconciled;
  }

  if (!selectedHost) {
    if (isResolveOnlyBinding(binding)) {
      return reconciled;
    }
    return reconciled;
  }

  const hostState = HOST_READINESS_TO_INVOCATION_READINESS[selectedHost.readiness.state];
  reconciled.state = compareReadinessStates(reconciled.state, hostState);
  reconciled.checkedAt = selectedHost.readiness.checkedAt ?? reconciled.checkedAt;

  if (!selectedHost.readiness.available) {
    reconciled.available = false;
    reconciled.reason =
      selectedHost.readiness.reason ??
      dispatch?.preflight.reason ??
      reconciled.reason ??
      `Runtime host \`${selectedHost.label}\` is not ready.`;
    return reconciled;
  }

  if (hostState === "attention") {
    const hostReason = selectedHost.readiness.reason;
    if (hostReason && !reconciled.warnings.includes(hostReason)) {
      reconciled.warnings.push(hostReason);
    }
    if (!reconciled.reason) {
      reconciled.reason = hostReason;
    }
  }

  if (dispatch?.preflight.reason && dispatch.preflight.reason !== reconciled.reason) {
    if (dispatch.preflight.state === "ready") {
      if (!reconciled.warnings.includes(dispatch.preflight.reason)) {
        reconciled.warnings.push(dispatch.preflight.reason);
      }
    } else {
      reconciled.reason = dispatch.preflight.reason;
    }
  }

  return reconciled;
}

export function summarizeRuntimeInvocationDispatchProvenance(
  response: RuntimeInvocationDispatchResponse
): RuntimeInvocationDispatchProvenanceSummary {
  return {
    invocationId: response.invocationId,
    status: response.status,
    summary: response.summary,
    hostId: response.provenance.hostId,
    category: response.provenance.category,
    registryVersion: response.provenance.registryVersion,
    workspaceId: response.provenance.workspaceId,
    caller: response.provenance.caller,
    preflightState: response.preflight.state,
    preflightReason: response.preflight.reason,
    postExecutionApplied: response.postExecution.applied,
    postExecutionSummary: response.postExecution.summary,
    postExecutionMetadata: response.postExecution.metadata,
  };
}

export function classifyRuntimeInvocationFallback(input: {
  descriptor: InvocationDescriptor;
  hostSelectionSummary?: RuntimeInvocationHostSelectionSummary | null;
  runtimeDispatchResponse?: RuntimeInvocationDispatchResponse | null;
}): RuntimeInvocationFallbackClassification {
  const execution = input.descriptor.execution ?? buildInvocationExecutionPlan(input.descriptor);
  const selectedDispatchMode = input.hostSelectionSummary?.dispatchMode ?? null;
  const dispatchStatus = input.runtimeDispatchResponse?.status ?? null;

  if (isResolveOnlyBinding(execution.binding) || dispatchStatus === "resolved") {
    return "resolve-only";
  }

  if (dispatchStatus === "accepted") {
    return "runtime-canonical";
  }

  if (selectedDispatchMode === "execute" && dispatchStatus == null) {
    return "runtime-canonical";
  }

  if (selectedDispatchMode === "execute" && dispatchStatus === "unsupported") {
    return "compat-fallback";
  }

  return "runtime-canonical";
}

export function buildRuntimeInvocationDispatchOutcome(
  response: RuntimeInvocationDispatchResponse
): InvocationExecutionOutcome {
  return {
    status: DISPATCH_STATUS_TO_OUTCOME_STATUS[response.status],
    summary: response.postExecution.applied
      ? `${response.summary} ${response.postExecution.summary}`.trim()
      : response.summary,
  };
}

export function resolveRuntimeInvocationPlaneFacade(
  input: ResolveRuntimeInvocationPlaneFacadeInput
): RuntimeInvocationPlaneFacadeResult {
  const caller = resolvePlaneFacadeCaller(input);
  const execution = input.descriptor.execution ?? buildInvocationExecutionPlan(input.descriptor);
  const hostSelection = resolveRuntimeInvocationHostSelectionSummary({
    descriptor: input.descriptor,
    runtimeHostRegistry: input.runtimeHostRegistry,
    runtimeDispatchResponse: input.runtimeDispatchResponse,
  });
  const fallbackClassification = classifyRuntimeInvocationFallback({
    descriptor: input.descriptor,
    hostSelectionSummary: hostSelection,
    runtimeDispatchResponse: input.runtimeDispatchResponse,
  });
  const reconciledReadiness = reconcileRuntimeInvocationDescriptorReadiness({
    descriptor: input.descriptor,
    hostSelectionSummary: hostSelection,
    runtimeDispatchResponse: input.runtimeDispatchResponse,
  });
  const dispatchProvenance = input.runtimeDispatchResponse
    ? summarizeRuntimeInvocationDispatchProvenance(input.runtimeDispatchResponse)
    : null;
  const outcome = input.runtimeDispatchResponse
    ? buildRuntimeInvocationDispatchOutcome(input.runtimeDispatchResponse)
    : null;

  const evidence = outcome
    ? {
        ...buildInvocationExecutionEvidence({
          descriptor: {
            ...input.descriptor,
            execution,
            readiness: reconciledReadiness,
          },
          caller,
          outcome,
        }),
        preflight: {
          state: input.runtimeDispatchResponse?.preflight.state ?? execution.preflight.state,
          summary:
            input.runtimeDispatchResponse?.preflight.reason ??
            input.runtimeDispatchResponse?.summary ??
            execution.preflight.summary,
        },
        preflightOutcome: {
          state: input.runtimeDispatchResponse?.preflight.state ?? execution.preflightOutcome.state,
          summary:
            input.runtimeDispatchResponse?.preflight.reason ??
            input.runtimeDispatchResponse?.summary ??
            execution.preflightOutcome.summary,
          required: execution.preflightOutcome.required,
          readinessState: reconciledReadiness.state,
        },
        placementRationale: {
          summary: hostSelection.selectedHost
            ? `Dispatch reconciled through runtime host \`${hostSelection.selectedHost.label}\` (${hostSelection.selectedHost.category}).`
            : fallbackClassification === "resolve-only"
              ? "Resolved through the shared prompt/session facade without runtime host execution."
              : `Execution remains on the ${fallbackClassification} path because runtime host dispatch was not selected.`,
          reason:
            input.runtimeDispatchResponse?.preflight.reason ??
            hostSelection.selectedHost?.readiness.reason ??
            reconciledReadiness.reason,
        },
      }
    : null;

  return {
    caller,
    workspaceId: resolvePlaneFacadeWorkspaceId(input),
    execution,
    hostSelection,
    dispatchProvenance,
    fallbackClassification,
    reconciledReadiness,
    outcome,
    evidence,
  };
}
