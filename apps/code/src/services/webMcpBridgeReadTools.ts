import type { AgentCommandCenterSnapshot } from "./webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

export type WebMcpReadToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: {
    readOnlyHint?: boolean;
  };
  execute: (input: JsonRecord, agent: unknown) => unknown;
};

type BuildReadToolsHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
};

export function buildReadTools(
  snapshot: AgentCommandCenterSnapshot,
  helpers: BuildReadToolsHelpers
): WebMcpReadToolDescriptor[] {
  return [
    {
      name: "get-project-overview",
      description:
        "Return current user intent and workspace control-plane summary for this workspace.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: () =>
        helpers.buildResponse("Project overview retrieved.", {
          workspaceId: snapshot.workspaceId,
          workspaceName: snapshot.workspaceName,
          intent: snapshot.intent,
          summary: {
            localProjectBoardRemoved: true,
            runtimeOrchestrationOwnedByRuntime: true,
            activeLocalTaskCount: 0,
          },
          updatedAt: snapshot.updatedAt,
        }),
      annotations: { readOnlyHint: true },
    },
  ];
}
