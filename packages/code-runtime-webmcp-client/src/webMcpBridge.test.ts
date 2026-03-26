import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncWebMcpAgentControl, teardownWebMcpAgentControl } from "./webMcpBridge";
import type {
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  WebMcpToolDescriptor,
} from "./webMcpBridgeTypes";

const snapshot: AgentCommandCenterSnapshot = {
  workspaceId: "ws-1",
  workspaceName: "workspace-one",
  intent: {
    objective: "Ship runtime context improvements",
    constraints: "Keep behavior stable",
    successCriteria: "Validation passes",
    deadline: null,
    priority: "high",
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

const actions: AgentCommandCenterActions = {
  setIntentPatch: vi.fn(() => snapshot.intent),
  setGovernancePolicyPatch: vi.fn(() => snapshot.governance.policy),
  runGovernanceCycle: vi.fn(() => ({
    source: "manual" as const,
    runAt: Date.now(),
    inspected: 0,
    pausedCount: 0,
    terminatedCount: 0,
    reassignedCount: 0,
    ownerPool: [],
    notes: [],
  })),
  upsertTask: vi.fn(),
  moveTask: vi.fn(),
  pauseTask: vi.fn(),
  resumeTask: vi.fn(),
  terminateTask: vi.fn(),
  rebalanceTasks: vi.fn(() => ({ updatedCount: 0, owners: [] })),
  assignTask: vi.fn(),
  removeTask: vi.fn(() => false),
  clearCompleted: vi.fn(() => 0),
};

function createTool(name: string): WebMcpToolDescriptor {
  return {
    name,
    description: `${name} description`,
    inputSchema: { type: "object", properties: {} },
    execute: vi.fn(),
  };
}

describe("webMcpBridge", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(async () => {
    await teardownWebMcpAgentControl();
  });

  it("passes tool exposure profiles into policy resolution and filters the synced catalog", async () => {
    const provideContext = vi.fn();
    Object.assign(globalThis.navigator, {
      modelContext: {
        provideContext,
      },
    });
    const resolveToolExposurePolicy = vi.fn(({ toolNames }: { toolNames: string[] }) => ({
      provider: "openai",
      mode: "minimal" as const,
      visibleToolNames: ["get-project-overview", "read-workspace-file"],
      hiddenToolNames: toolNames.filter(
        (toolName) => !["get-project-overview", "read-workspace-file"].includes(toolName)
      ),
      reasonCodes: ["runtime-prefers-minimal-tool-catalog"],
    }));

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      toolExposureProfile: "minimal",
      runtimeToolNames: ["read-workspace-file", "get-runtime-settings"],
      buildReadTools: () => [createTool("get-project-overview")],
      buildWriteTools: () => [],
      buildRuntimeTools: () => [
        createTool("read-workspace-file"),
        createTool("get-runtime-settings"),
      ],
      wrapToolsWithInputSchemaPreflight: (tools) => tools,
      resolveToolExposurePolicy,
      buildResources: () => [],
      buildPrompts: () => [],
    });

    expect(resolveToolExposurePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolExposureProfile: "minimal",
      })
    );
    expect(provideContext).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({ name: "get-project-overview" }),
          expect.objectContaining({ name: "read-workspace-file" }),
        ],
      })
    );
    expect(
      provideContext.mock.calls[0]?.[0]?.tools?.some(
        (tool: { name: string }) => tool.name === "get-runtime-settings"
      )
    ).toBe(false);
    expect(result.registeredTools).toBe(2);
  });
});
