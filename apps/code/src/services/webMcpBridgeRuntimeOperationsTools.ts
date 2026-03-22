import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimeOperationsControl = RuntimeAgentControl & {
  getRuntimeRemoteStatus?: () => Promise<unknown>;
  getRuntimeSettings?: () => Promise<unknown>;
  getRuntimeBootstrapSnapshot?: () => Promise<unknown>;
  runtimeDiagnosticsExportV1?: (input?: {
    workspaceId?: string | null;
    redactionLevel?: "strict" | "balanced" | "minimal";
    includeTaskSummaries?: boolean;
  }) => Promise<unknown>;
  runtimeSessionExportV1?: (input: {
    workspaceId: string;
    threadId: string;
    includeAgentTasks?: boolean;
  }) => Promise<unknown>;
  runtimeSessionImportV1?: (input: {
    workspaceId: string;
    snapshot: Record<string, unknown>;
    threadId?: string | null;
  }) => Promise<unknown>;
  runtimeSessionDeleteV1?: (input: { workspaceId: string; threadId: string }) => Promise<boolean>;
  runtimeSecurityPreflightV1?: (input: {
    workspaceId?: string | null;
    toolName?: string | null;
    command?: string | null;
    input?: Record<string, unknown> | null;
    checkPackageAdvisory?: boolean;
    checkExecPolicy?: boolean;
    execPolicyRules?: string[] | null;
  }) => Promise<unknown>;
  runRuntimeCodexDoctor?: (input?: {
    codexBin?: string | null;
    codexArgs?: string[] | null;
  }) => Promise<unknown>;
  runRuntimeCodexUpdate?: (input?: {
    codexBin?: string | null;
    codexArgs?: string[] | null;
  }) => Promise<unknown>;
};

type RuntimeOperationsControlMethodName =
  | "getRuntimeRemoteStatus"
  | "getRuntimeSettings"
  | "getRuntimeBootstrapSnapshot"
  | "runtimeDiagnosticsExportV1"
  | "runtimeSessionExportV1"
  | "runtimeSessionImportV1"
  | "runtimeSessionDeleteV1"
  | "runtimeSecurityPreflightV1"
  | "runRuntimeCodexDoctor"
  | "runRuntimeCodexUpdate";

type RuntimeOperationsHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "confirmWriteAction" | "toNonEmptyString"
>;

function requireRuntimeOperationsControlMethod<
  MethodName extends RuntimeOperationsControlMethodName,
>(
  control: RuntimeOperationsControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeOperationsControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeOperationsControl[MethodName]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toRedactionLevel(value: unknown): "strict" | "balanced" | "minimal" | null {
  if (value !== "strict" && value !== "balanced" && value !== "minimal") {
    return null;
  }
  return value;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toExecPolicyRules(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rules = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return rules.length > 0 ? rules : null;
}

function toOptionalStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw invalidInputError("codexArgs must be a string array when provided.");
  }
  return value.map((entry) => entry.trim());
}

export function buildRuntimeOperationsTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimeOperationsHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeOperationsControl;

  return [
    {
      name: "get-runtime-remote-status",
      description: "Read runtime remote connectivity and transport status.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const getRuntimeRemoteStatus = requireRuntimeOperationsControlMethod(
          control,
          "getRuntimeRemoteStatus",
          "get-runtime-remote-status"
        );
        const status = await getRuntimeRemoteStatus();
        return helpers.buildResponse("Runtime remote status retrieved.", {
          workspaceId: snapshot.workspaceId,
          status,
        });
      },
    },
    {
      name: "get-runtime-settings",
      description: "Read the effective runtime settings snapshot.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const getRuntimeSettings = requireRuntimeOperationsControlMethod(
          control,
          "getRuntimeSettings",
          "get-runtime-settings"
        );
        const settings = await getRuntimeSettings();
        return helpers.buildResponse("Runtime settings retrieved.", {
          workspaceId: snapshot.workspaceId,
          settings,
        });
      },
    },
    {
      name: "get-runtime-bootstrap-snapshot",
      description: "Read the runtime bootstrap snapshot used to initialize agent state.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const getRuntimeBootstrapSnapshot = requireRuntimeOperationsControlMethod(
          control,
          "getRuntimeBootstrapSnapshot",
          "get-runtime-bootstrap-snapshot"
        );
        const bootstrap = await getRuntimeBootstrapSnapshot();
        return helpers.buildResponse("Runtime bootstrap snapshot retrieved.", {
          workspaceId: snapshot.workspaceId,
          bootstrap,
        });
      },
    },
    {
      name: "export-runtime-diagnostics",
      description: "Export a runtime diagnostics snapshot with optional redaction controls.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          redactionLevel: { type: "string", enum: ["strict", "balanced", "minimal"] },
          includeTaskSummaries: { type: "boolean" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const runtimeDiagnosticsExportV1 = requireRuntimeOperationsControlMethod(
          control,
          "runtimeDiagnosticsExportV1",
          "export-runtime-diagnostics"
        );
        const redactionLevel =
          input.redactionLevel === undefined ? undefined : toRedactionLevel(input.redactionLevel);
        if (input.redactionLevel !== undefined && !redactionLevel) {
          throw invalidInputError("redactionLevel must be strict, balanced, or minimal.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const diagnostics = await runtimeDiagnosticsExportV1({
          workspaceId,
          ...(redactionLevel ? { redactionLevel } : {}),
          ...(typeof input.includeTaskSummaries === "boolean"
            ? { includeTaskSummaries: input.includeTaskSummaries }
            : {}),
        });
        return helpers.buildResponse("Runtime diagnostics export completed.", {
          workspaceId,
          diagnostics,
          available: diagnostics !== null,
        });
      },
    },
    {
      name: "evaluate-runtime-security-preflight",
      description:
        "Evaluate runtime security preflight for a tool call or command before execution.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          toolName: { type: "string" },
          command: { type: "string" },
          input: { type: "object", additionalProperties: true },
          checkPackageAdvisory: { type: "boolean" },
          checkExecPolicy: { type: "boolean" },
          execPolicyRules: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const runtimeSecurityPreflightV1 = requireRuntimeOperationsControlMethod(
          control,
          "runtimeSecurityPreflightV1",
          "evaluate-runtime-security-preflight"
        );
        const decision = await runtimeSecurityPreflightV1({
          workspaceId: helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId,
          toolName: helpers.toNonEmptyString(input.toolName),
          command: helpers.toNonEmptyString(input.command),
          input: input.input && asRecord(input.input) ? (input.input as JsonRecord) : null,
          checkPackageAdvisory: toOptionalBoolean(input.checkPackageAdvisory),
          checkExecPolicy: toOptionalBoolean(input.checkExecPolicy),
          execPolicyRules: toExecPolicyRules(input.execPolicyRules),
        });
        return helpers.buildResponse("Runtime security preflight evaluated.", {
          workspaceId: helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId,
          decision,
        });
      },
    },
    {
      name: "run-runtime-codex-doctor",
      description: "Run runtime Codex doctor to inspect local Codex health and dependencies.",
      inputSchema: {
        type: "object",
        properties: {
          codexBin: { type: "string" },
          codexArgs: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const runRuntimeCodexDoctor = requireRuntimeOperationsControlMethod(
          control,
          "runRuntimeCodexDoctor",
          "run-runtime-codex-doctor"
        );
        const result = await runRuntimeCodexDoctor({
          codexBin: helpers.toNonEmptyString(input.codexBin),
          codexArgs: toOptionalStringArray(input.codexArgs),
        });
        return helpers.buildResponse("Runtime codex doctor completed.", {
          workspaceId: snapshot.workspaceId,
          result,
        });
      },
    },
    {
      name: "run-runtime-codex-update",
      description: "Run runtime Codex update to repair or upgrade the local Codex install.",
      inputSchema: {
        type: "object",
        properties: {
          codexBin: { type: "string" },
          codexArgs: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      execute: async (input, agent) => {
        const runRuntimeCodexUpdate = requireRuntimeOperationsControlMethod(
          control,
          "runRuntimeCodexUpdate",
          "run-runtime-codex-update"
        );
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Run runtime Codex update in workspace ${snapshot.workspaceId}.`,
          onApprovalRequest
        );
        const result = await runRuntimeCodexUpdate({
          codexBin: helpers.toNonEmptyString(input.codexBin),
          codexArgs: toOptionalStringArray(input.codexArgs),
        });
        return helpers.buildResponse("Runtime codex update completed.", {
          workspaceId: snapshot.workspaceId,
          result,
        });
      },
    },
    {
      name: "export-runtime-session",
      description: "Export a runtime thread/session snapshot for portability or backup.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          threadId: { type: "string" },
          includeAgentTasks: { type: "boolean" },
        },
        required: ["threadId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const runtimeSessionExportV1 = requireRuntimeOperationsControlMethod(
          control,
          "runtimeSessionExportV1",
          "export-runtime-session"
        );
        const threadId = helpers.toNonEmptyString(input.threadId);
        if (!threadId) {
          throw requiredInputError("threadId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const session = await runtimeSessionExportV1({
          workspaceId,
          threadId,
          ...(typeof input.includeAgentTasks === "boolean"
            ? { includeAgentTasks: input.includeAgentTasks }
            : {}),
        });
        return helpers.buildResponse("Runtime session export completed.", {
          workspaceId,
          threadId,
          session,
          exported: session !== null,
        });
      },
    },
    {
      name: "import-runtime-session",
      description: "Import a runtime session snapshot into a workspace thread.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          threadId: { type: "string" },
          snapshot: { type: "object", additionalProperties: true },
        },
        required: ["snapshot"],
      },
      execute: async (input, agent) => {
        const runtimeSessionImportV1 = requireRuntimeOperationsControlMethod(
          control,
          "runtimeSessionImportV1",
          "import-runtime-session"
        );
        const snapshotRecord = asRecord(input.snapshot);
        if (!snapshotRecord) {
          throw requiredInputError("snapshot is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const threadId = helpers.toNonEmptyString(input.threadId);
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Import runtime session into workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const result = await runtimeSessionImportV1({
          workspaceId,
          snapshot: snapshotRecord,
          ...(threadId ? { threadId } : {}),
        });
        return helpers.buildResponse("Runtime session import completed.", {
          workspaceId,
          threadId: threadId ?? null,
          result,
          imported: result !== null,
          warnings: asStringArray(asRecord(result)?.warnings),
        });
      },
    },
    {
      name: "delete-runtime-session",
      description: "Delete a runtime session/thread snapshot by workspace and thread id.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          threadId: { type: "string" },
        },
        required: ["threadId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        const runtimeSessionDeleteV1 = requireRuntimeOperationsControlMethod(
          control,
          "runtimeSessionDeleteV1",
          "delete-runtime-session"
        );
        const threadId = helpers.toNonEmptyString(input.threadId);
        if (!threadId) {
          throw requiredInputError("threadId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Delete runtime session ${threadId} from workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const deleted = await runtimeSessionDeleteV1({ workspaceId, threadId });
        return helpers.buildResponse("Runtime session delete completed.", {
          workspaceId,
          threadId,
          deleted,
        });
      },
    },
  ];
}
