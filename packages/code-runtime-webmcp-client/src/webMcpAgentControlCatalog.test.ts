import { describe, expect, it, vi } from "vitest";
import type { AgentCommandCenterActions, AgentCommandCenterSnapshot } from "./webMcpBridgeTypes";
import { buildAgentControlWriteTools, buildResponse } from "./webMcpAgentControlCatalog";

const snapshot: AgentCommandCenterSnapshot = {
  workspaceId: "ws-1",
  workspaceName: "workspace-one",
  intent: {
    objective: "Ship runtime improvements",
    constraints: "No regressions",
    successCriteria: "Stable WebMCP bridge",
    deadline: null,
    priority: "medium",
    managerNotes: null,
  },
  tasks: [],
  governance: {
    policy: {
      autoEnabled: false,
      intervalMinutes: 5,
      pauseBlockedInProgress: true,
      reassignUnowned: true,
      terminateOverdueDays: 5,
      ownerPool: [],
    },
    lastCycle: null,
  },
  auditLog: [],
  updatedAt: Date.now(),
};

describe("@ku0/code-runtime-webmcp-client agent control catalog", () => {
  it("builds shared write tools for structured intent updates", async () => {
    const setIntentPatch = vi.fn((patch) => ({ ...snapshot.intent, ...patch }));
    const actions = {
      setIntentPatch,
    } as AgentCommandCenterActions;
    const [tool] = buildAgentControlWriteTools({
      snapshot,
      actions,
      requireUserApproval: false,
      buildResponse,
    });

    const result = await tool?.execute(
      {
        objective: "Close ownership in shared runtime packages",
        priority: "critical",
      },
      null
    );

    expect(setIntentPatch).toHaveBeenCalledWith({
      objective: "Close ownership in shared runtime packages",
      priority: "critical",
    });
    expect(result).toMatchObject({
      data: {
        workspaceId: "ws-1",
        intent: expect.objectContaining({
          objective: "Close ownership in shared runtime packages",
          priority: "critical",
        }),
      },
    });
  });
});
