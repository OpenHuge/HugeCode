import { invalidInputError } from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type RuntimeWorkspaceDiagnosticsControl = RuntimeAgentControl & {
  listWorkspaceDiagnostics?: (input: {
    workspaceId: string;
    paths?: string[] | null;
    severities?: Array<"error" | "warning" | "info" | "hint"> | null;
    maxItems?: number | null;
    includeProviderDetails?: boolean;
  }) => Promise<unknown>;
};

type JsonRecord = Record<string, unknown>;
type WorkspaceDiagnosticSeverity = "error" | "warning" | "info" | "hint";

const VALID_SEVERITIES: ReadonlySet<WorkspaceDiagnosticSeverity> = new Set([
  "error",
  "warning",
  "info",
  "hint",
]);

function parseOptionalStringArray(value: unknown, fieldName: string): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return normalized.length > 0 ? normalized : null;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw invalidInputError(`${fieldName} must be a string array or comma-delimited string.`);
  }
  const normalized = value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalSeverityArray(value: unknown): WorkspaceDiagnosticSeverity[] | null {
  const parsed = parseOptionalStringArray(value, "severities");
  if (!parsed) {
    return null;
  }
  const normalized = parsed.map((entry) => entry.toLowerCase()) as WorkspaceDiagnosticSeverity[];
  for (const severity of normalized) {
    if (!VALID_SEVERITIES.has(severity)) {
      throw invalidInputError("severities must only include error, warning, info, or hint.");
    }
  }
  return normalized;
}

function buildUnavailableResult(workspaceId: string, reason: string): JsonRecord {
  return {
    workspaceId,
    diagnostics: {
      available: false,
      summary: {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        total: 0,
      },
      items: [],
      providers: [],
      generatedAtMs: Date.now(),
      reason,
    },
    available: false,
    reason,
  };
}

function readAvailability(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.available !== false;
}

export function buildRuntimeWorkspaceDiagnosticsTools(
  options: Pick<BuildRuntimeToolsOptions, "snapshot" | "runtimeControl" | "helpers">
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, helpers } = options;
  const control = runtimeControl as RuntimeWorkspaceDiagnosticsControl;

  return [
    {
      name: "inspect-workspace-diagnostics",
      description:
        "Inspect structured workspace diagnostics for the active runtime workspace, with optional path and severity filters.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          paths: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          severities: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          maxItems: { type: "number" },
          includeProviderDetails: { type: "boolean" },
        },
      },
      annotations: {
        readOnlyHint: true,
        title: "Inspect Workspace Diagnostics",
        taskSupport: "full",
      },
      execute: async (input) => {
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const listWorkspaceDiagnostics = control.listWorkspaceDiagnostics;
        if (typeof listWorkspaceDiagnostics !== "function") {
          return helpers.buildResponse(
            "Workspace diagnostics are unavailable in the current runtime.",
            buildUnavailableResult(workspaceId, "workspace diagnostics method unavailable")
          );
        }

        const maxItems = helpers.toPositiveInteger(input.maxItems);
        const result = await listWorkspaceDiagnostics({
          workspaceId,
          paths: parseOptionalStringArray(input.paths, "paths"),
          severities: parseOptionalSeverityArray(input.severities),
          maxItems,
          includeProviderDetails:
            typeof input.includeProviderDetails === "boolean" ? input.includeProviderDetails : true,
        });

        if (result === null) {
          return helpers.buildResponse(
            "Workspace diagnostics are unavailable in the current runtime.",
            buildUnavailableResult(workspaceId, "workspace diagnostics unavailable")
          );
        }

        return helpers.buildResponse("Workspace diagnostics retrieved.", {
          workspaceId,
          diagnostics: result,
          available: readAvailability(result),
        });
      },
    },
  ];
}
