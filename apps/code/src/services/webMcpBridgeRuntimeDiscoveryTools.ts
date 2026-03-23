import { methodUnavailableError } from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimeDiscoveryControl = RuntimeAgentControl & {
  listRuntimeMcpServerStatus?: (input: {
    workspaceId: string;
    cursor?: string | null;
    limit?: number | null;
  }) => Promise<unknown>;
};

type RuntimeDiscoveryControlMethodName = "listRuntimeMcpServerStatus";

type RuntimeDiscoveryHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "toNonEmptyString" | "toPositiveInteger"
>;

function requireRuntimeDiscoveryControlMethod<MethodName extends RuntimeDiscoveryControlMethodName>(
  control: RuntimeDiscoveryControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeDiscoveryControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeDiscoveryControl[MethodName]>;
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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildRuntimeDiscoveryTools(
  options: Pick<BuildRuntimeToolsOptions, "snapshot" | "runtimeControl"> & {
    helpers: RuntimeDiscoveryHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, helpers } = options;
  const control = runtimeControl as RuntimeDiscoveryControl;

  return [
    {
      name: "list-runtime-mcp-server-status",
      description: "List runtime MCP server status, auth state, and exported tool metadata.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          cursor: { type: "string" },
          limit: { type: "number" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeMcpServerStatus = requireRuntimeDiscoveryControlMethod(
          control,
          "listRuntimeMcpServerStatus",
          "list-runtime-mcp-server-status"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const response = asRecord(
          await listRuntimeMcpServerStatus({
            workspaceId,
            cursor: helpers.toNonEmptyString(input.cursor),
            limit: helpers.toPositiveInteger(input.limit),
          })
        );
        const servers = asArray(response?.data);
        return helpers.buildResponse("Runtime MCP server status retrieved.", {
          workspaceId,
          total: servers.length,
          servers,
          nextCursor:
            typeof response?.nextCursor === "string" || response?.nextCursor === null
              ? response?.nextCursor
              : null,
          warnings: asStringArray(response?.warnings),
        });
      },
    },
  ];
}
