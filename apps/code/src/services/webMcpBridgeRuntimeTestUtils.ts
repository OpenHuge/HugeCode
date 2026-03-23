import type { AgentCommandCenterSnapshot } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type SnapshotOverrides = Omit<Partial<AgentCommandCenterSnapshot>, "intent" | "governance"> & {
  intent?: Partial<AgentCommandCenterSnapshot["intent"]>;
  governance?: Omit<Partial<AgentCommandCenterSnapshot["governance"]>, "policy"> & {
    policy?: Partial<AgentCommandCenterSnapshot["governance"]["policy"]>;
  };
};

export function createAgentCommandCenterSnapshot(
  overrides: SnapshotOverrides = {}
): AgentCommandCenterSnapshot {
  const baseSnapshot: AgentCommandCenterSnapshot = {
    workspaceId: "ws-1",
    workspaceName: "workspace-one",
    intent: {
      objective: "objective",
      constraints: "",
      successCriteria: "",
      deadline: null,
      priority: "medium",
      managerNotes: "",
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

  return {
    ...baseSnapshot,
    ...overrides,
    intent: {
      ...baseSnapshot.intent,
      ...overrides.intent,
    },
    governance: {
      ...baseSnapshot.governance,
      ...overrides.governance,
      policy: {
        ...baseSnapshot.governance.policy,
        ...overrides.governance?.policy,
      },
    },
    tasks: overrides.tasks ?? baseSnapshot.tasks,
    auditLog: overrides.auditLog ?? baseSnapshot.auditLog,
  };
}
