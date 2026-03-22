import type {
  RuntimeBackendRolloutState,
  RuntimeBackendSetStateRequest,
  RuntimeBackendStatus,
  RuntimeBackendUpsertInput,
} from "@ku0/code-runtime-host-contract";
import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import type {
  BuildRuntimeToolsOptions,
  WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type RuntimeBackendControl = RuntimeAgentControl & {
  runtimeBackendSetState?: (
    input: RuntimeBackendSetStateRequest & { workspaceId?: string | null }
  ) => Promise<unknown>;
  runtimeBackendRemove?: (input: {
    backendId: string;
    workspaceId?: string | null;
  }) => Promise<boolean | null>;
  runtimeBackendUpsert?: (
    input: RuntimeBackendUpsertInput & { workspaceId?: string | null }
  ) => Promise<unknown>;
};

type RuntimeBackendControlMethodName =
  | "runtimeBackendSetState"
  | "runtimeBackendRemove"
  | "runtimeBackendUpsert";

type RuntimeBackendControlHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  | "buildResponse"
  | "confirmWriteAction"
  | "toNonEmptyString"
  | "toPositiveInteger"
  | "toStringArray"
>;

const RUNTIME_BACKEND_STATUS_VALUES = ["active", "draining", "disabled"] as const;
const RUNTIME_BACKEND_ROLLOUT_STATE_VALUES = ["current", "ramping", "draining", "drained"] as const;

function requireRuntimeBackendControlMethod<MethodName extends RuntimeBackendControlMethodName>(
  control: RuntimeBackendControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeBackendControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeBackendControl[MethodName]>;
}

function toRuntimeBackendStatus(value: unknown): RuntimeBackendStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalizedValue = value.trim();
  return RUNTIME_BACKEND_STATUS_VALUES.includes(normalizedValue as RuntimeBackendStatus)
    ? (normalizedValue as RuntimeBackendStatus)
    : null;
}

function toRuntimeBackendRolloutState(value: unknown): RuntimeBackendRolloutState | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalizedValue = value.trim();
  return RUNTIME_BACKEND_ROLLOUT_STATE_VALUES.includes(
    normalizedValue as RuntimeBackendRolloutState
  )
    ? (normalizedValue as RuntimeBackendRolloutState)
    : null;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getRequiredBackendId(
  input: Record<string, unknown>,
  helpers: RuntimeBackendControlHelpers
): string {
  const backendId = helpers.toNonEmptyString(input.backendId);
  if (!backendId) {
    throw requiredInputError("backendId is required.");
  }
  return backendId;
}

function getRequiredDisplayName(
  input: Record<string, unknown>,
  helpers: RuntimeBackendControlHelpers
): string {
  const displayName = helpers.toNonEmptyString(input.displayName);
  if (!displayName) {
    throw requiredInputError("displayName is required.");
  }
  return displayName;
}

function getRequiredCapabilities(
  input: Record<string, unknown>,
  helpers: RuntimeBackendControlHelpers
): string[] {
  const capabilities = helpers
    .toStringArray(input.capabilities)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (capabilities.length === 0) {
    throw invalidInputError("capabilities must be a non-empty array of strings.");
  }
  return capabilities;
}

function getRequiredMaxConcurrency(
  input: Record<string, unknown>,
  helpers: RuntimeBackendControlHelpers
): number {
  const maxConcurrency = helpers.toPositiveInteger(input.maxConcurrency);
  if (!maxConcurrency) {
    throw invalidInputError("maxConcurrency must be a positive integer.");
  }
  return maxConcurrency;
}

export function buildRuntimeBackendControlTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimeBackendControlHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeBackendControl;

  return [
    {
      name: "set-runtime-backend-state",
      description: "Update runtime backend pool state using canonical backend status fields.",
      inputSchema: {
        type: "object",
        properties: {
          backendId: { type: "string" },
          status: { type: "string", enum: [...RUNTIME_BACKEND_STATUS_VALUES] },
          rolloutState: { type: "string", enum: [...RUNTIME_BACKEND_ROLLOUT_STATE_VALUES] },
          force: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["backendId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Update runtime backend state in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runtimeBackendSetState = requireRuntimeBackendControlMethod(
          control,
          "runtimeBackendSetState",
          "set-runtime-backend-state"
        );
        const status =
          input.status === undefined
            ? undefined
            : (() => {
                const normalizedStatus = toRuntimeBackendStatus(input.status);
                if (!normalizedStatus) {
                  throw invalidInputError("status must be active, draining, or disabled.");
                }
                return normalizedStatus;
              })();
        const rolloutState =
          input.rolloutState === undefined
            ? undefined
            : (() => {
                const normalizedRolloutState = toRuntimeBackendRolloutState(input.rolloutState);
                if (!normalizedRolloutState) {
                  throw invalidInputError(
                    "rolloutState must be current, ramping, draining, or drained."
                  );
                }
                return normalizedRolloutState;
              })();
        if (!status && !rolloutState) {
          throw requiredInputError("status or rolloutState is required.");
        }
        const backend = await runtimeBackendSetState({
          workspaceId: snapshot.workspaceId,
          backendId: getRequiredBackendId(input, helpers),
          status,
          rolloutState,
          force: toOptionalBoolean(input.force),
          reason: helpers.toNonEmptyString(input.reason),
        });
        if (backend === null) {
          throw methodUnavailableError("set-runtime-backend-state", "runtimeBackendSetState");
        }
        return helpers.buildResponse("Runtime backend state updated.", {
          workspaceId: snapshot.workspaceId,
          backend,
        });
      },
    },
    {
      name: "remove-runtime-backend",
      description: "Remove a runtime backend from the backend pool.",
      inputSchema: {
        type: "object",
        properties: {
          backendId: { type: "string" },
        },
        required: ["backendId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Remove a runtime backend from workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runtimeBackendRemove = requireRuntimeBackendControlMethod(
          control,
          "runtimeBackendRemove",
          "remove-runtime-backend"
        );
        const backendId = getRequiredBackendId(input, helpers);
        const removed = await runtimeBackendRemove({
          workspaceId: snapshot.workspaceId,
          backendId,
        });
        if (removed === null) {
          throw methodUnavailableError("remove-runtime-backend", "runtimeBackendRemove");
        }
        return helpers.buildResponse("Runtime backend removed.", {
          workspaceId: snapshot.workspaceId,
          backendId,
          removed,
        });
      },
    },
    {
      name: "upsert-runtime-backend",
      description: "Create or update a runtime backend using the full backend specification.",
      inputSchema: {
        type: "object",
        properties: {
          backendId: { type: "string" },
          displayName: { type: "string" },
          capabilities: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          maxConcurrency: { type: "number" },
          costTier: { type: "string" },
          latencyClass: { type: "string" },
          rolloutState: { type: "string", enum: [...RUNTIME_BACKEND_ROLLOUT_STATE_VALUES] },
          status: { type: "string", enum: [...RUNTIME_BACKEND_STATUS_VALUES] },
        },
        required: [
          "backendId",
          "displayName",
          "capabilities",
          "maxConcurrency",
          "costTier",
          "latencyClass",
          "rolloutState",
          "status",
        ],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Upsert runtime backend configuration in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runtimeBackendUpsert = requireRuntimeBackendControlMethod(
          control,
          "runtimeBackendUpsert",
          "upsert-runtime-backend"
        );
        const costTier = helpers.toNonEmptyString(input.costTier);
        if (!costTier) {
          throw requiredInputError("costTier is required.");
        }
        const latencyClass = helpers.toNonEmptyString(input.latencyClass);
        if (!latencyClass) {
          throw requiredInputError("latencyClass is required.");
        }
        const rolloutState = toRuntimeBackendRolloutState(input.rolloutState);
        if (!rolloutState) {
          throw invalidInputError("rolloutState must be current, ramping, draining, or drained.");
        }
        const status = toRuntimeBackendStatus(input.status);
        if (!status) {
          throw invalidInputError("status must be active, draining, or disabled.");
        }
        const backend = await runtimeBackendUpsert({
          workspaceId: snapshot.workspaceId,
          backendId: getRequiredBackendId(input, helpers),
          displayName: getRequiredDisplayName(input, helpers),
          capabilities: getRequiredCapabilities(input, helpers),
          maxConcurrency: getRequiredMaxConcurrency(input, helpers),
          costTier,
          latencyClass,
          rolloutState,
          status,
        });
        if (backend === null) {
          throw methodUnavailableError("upsert-runtime-backend", "runtimeBackendUpsert");
        }
        return helpers.buildResponse("Runtime backend upsert completed.", {
          workspaceId: snapshot.workspaceId,
          backend,
        });
      },
    },
  ];
}
