import type {
  RuntimeBackendClass,
  RuntimeBackendRolloutState,
  RuntimeBackendStatus,
  RuntimeBackendUpsertInput,
} from "@ku0/code-runtime-host-contract";
import type { BackendPoolEntry } from "../../../types/backendPool";

export type NativeBackendFormMode = "add" | "edit";

export type NativeBackendFormState = {
  backendId: string;
  displayName: string;
  capabilitiesText: string;
  maxConcurrency: string;
  costTier: string;
  latencyClass: string;
  backendClass: RuntimeBackendClass;
  specializationsText: string;
  rolloutState: RuntimeBackendRolloutState;
  status: RuntimeBackendStatus;
  trustTier: "trusted" | "standard" | "isolated";
  dataSensitivity: "public" | "internal" | "restricted";
  approvalPolicy: "runtime-default" | "checkpoint-required" | "never-auto-approve";
  allowedToolClassesText: string;
};

function splitMultiline(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function createEmptyNativeBackendFormState(): NativeBackendFormState {
  return {
    backendId: "",
    displayName: "",
    capabilitiesText: "general",
    maxConcurrency: "1",
    costTier: "standard",
    latencyClass: "standard",
    backendClass: "primary",
    specializationsText: "",
    rolloutState: "current",
    status: "active",
    trustTier: "standard",
    dataSensitivity: "internal",
    approvalPolicy: "checkpoint-required",
    allowedToolClassesText: "read\nwrite",
  };
}

function joinMultiline(values: string[]): string {
  return values.join("\n");
}

export function mapNativeBackendToFormState(backend: BackendPoolEntry): NativeBackendFormState {
  return {
    backendId: backend.backendId,
    displayName: backend.label,
    capabilitiesText: joinMultiline(backend.capabilities ?? ["general"]),
    maxConcurrency: `${backend.maxConcurrency ?? 1}`,
    costTier: backend.costTier ?? "standard",
    latencyClass: backend.latencyClass ?? "standard",
    backendClass: backend.backendClass ?? "primary",
    specializationsText: joinMultiline(backend.specializations ?? []),
    rolloutState: backend.rolloutState ?? "current",
    status:
      backend.status ??
      (backend.state === "disabled"
        ? "disabled"
        : backend.state === "draining"
          ? "draining"
          : "active"),
    trustTier: backend.policy?.trustTier ?? "standard",
    dataSensitivity: backend.policy?.dataSensitivity ?? "internal",
    approvalPolicy: backend.policy?.approvalPolicy ?? "checkpoint-required",
    allowedToolClassesText: joinMultiline(backend.policy?.allowedToolClasses ?? ["read", "write"]),
  };
}

export function mapNativeFormStateToUpsertInput(
  draft: NativeBackendFormState
): RuntimeBackendUpsertInput {
  const backendId = draft.backendId.trim();
  if (!backendId) {
    throw new Error("Backend ID is required.");
  }

  const displayName = draft.displayName.trim() || backendId;
  const maxConcurrency = Number.parseInt(draft.maxConcurrency.trim(), 10);
  if (!Number.isFinite(maxConcurrency) || maxConcurrency <= 0) {
    throw new Error("Max concurrency must be a positive integer.");
  }

  const capabilities = splitMultiline(draft.capabilitiesText);
  if (capabilities.length === 0) {
    throw new Error("At least one backend capability is required.");
  }
  const allowedToolClasses = splitMultiline(draft.allowedToolClassesText) as (
    | "read"
    | "write"
    | "exec"
    | "network"
    | "browser"
    | "mcp"
  )[];
  if (allowedToolClasses.length === 0) {
    throw new Error("At least one allowed tool class is required.");
  }

  return {
    backendId,
    displayName,
    capabilities,
    maxConcurrency,
    costTier: draft.costTier.trim() || "standard",
    latencyClass: draft.latencyClass.trim() || "standard",
    backendClass: draft.backendClass,
    specializations: splitMultiline(draft.specializationsText),
    rolloutState: draft.rolloutState,
    status: draft.status,
    policy: {
      trustTier: draft.trustTier,
      dataSensitivity: draft.dataSensitivity,
      approvalPolicy: draft.approvalPolicy,
      allowedToolClasses,
    },
  };
}
