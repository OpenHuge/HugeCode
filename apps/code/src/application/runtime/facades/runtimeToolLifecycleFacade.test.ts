import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent } from "../../../types";

type EventsTestApi = {
  subscribeAppServerEvents: ReturnType<typeof vi.fn>;
  __emitAppServerEvent: (event: AppServerEvent) => void;
  __appServerListenerCount: () => number;
  __resetAppServerMock: () => void;
};

type TelemetryEvent = {
  kind: "execution" | "guardrail_evaluated" | "guardrail_outcome";
  toolName: string;
  scope: "write" | "runtime" | "computer_observe";
  at: number;
  workspaceId: string | null;
  status: string | null;
  phase?: "attempted" | "started" | "completed";
  requestId?: string | null;
  result?: {
    allowed: boolean;
    blockReason: string | null;
  };
  errorCode?: string | null;
};

type TelemetryTestApi = {
  subscribeRuntimeToolExecutionTelemetryEvents: ReturnType<typeof vi.fn>;
  __emitRuntimeToolExecutionTelemetryEvent: (event: TelemetryEvent) => void;
  __telemetryListenerCount: () => number;
  __resetRuntimeToolExecutionTelemetryMock: () => void;
};

vi.mock("../ports/events", () => {
  const listeners = new Set<(event: AppServerEvent) => void>();
  const subscribeAppServerEvents = vi.fn((listener: (event: AppServerEvent) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });

  return {
    subscribeAppServerEvents,
    __emitAppServerEvent: (event: AppServerEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    __appServerListenerCount: () => listeners.size,
    __resetAppServerMock: () => {
      listeners.clear();
      subscribeAppServerEvents.mockClear();
    },
  };
});

vi.mock("../ports/runtimeToolExecutionTelemetry", () => {
  const listeners = new Set<(event: TelemetryEvent) => void>();
  const subscribeRuntimeToolExecutionTelemetryEvents = vi.fn(
    (listener: (event: TelemetryEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  );

  return {
    subscribeRuntimeToolExecutionTelemetryEvents,
    __emitRuntimeToolExecutionTelemetryEvent: (event: TelemetryEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    __telemetryListenerCount: () => listeners.size,
    __resetRuntimeToolExecutionTelemetryMock: () => {
      listeners.clear();
      subscribeRuntimeToolExecutionTelemetryEvents.mockClear();
    },
  };
});

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("runtimeToolLifecycleFacade", () => {
  beforeEach(async () => {
    vi.resetModules();
    const events = (await import("../ports/events")) as unknown as EventsTestApi;
    events.__resetAppServerMock();
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;
    telemetry.__resetRuntimeToolExecutionTelemetryMock();
  });

  it("shares app-event and telemetry subscriptions across listeners and snapshots", async () => {
    const facade = await import("./runtimeToolLifecycleFacade");
    const events = (await import("../ports/events")) as unknown as EventsTestApi;
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;

    const lifecycleListener = vi.fn();
    const workspaceOneLifecycleListener = vi.fn();
    const workspaceTwoLifecycleListener = vi.fn();
    const allWorkspaceLifecycleListener = vi.fn();
    const snapshotListener = vi.fn();
    const workspaceOneSnapshotListener = vi.fn();
    const workspaceTwoSnapshotListener = vi.fn();
    const allWorkspaceSnapshotListener = vi.fn();

    const unsubscribeEvents = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);
    const unsubscribeWorkspaceOneEvents = facade.subscribeWorkspaceRuntimeToolLifecycleEvents(
      "workspace-1",
      workspaceOneLifecycleListener
    );
    const unsubscribeWorkspaceTwoEvents = facade.subscribeWorkspaceRuntimeToolLifecycleEvents(
      "workspace-2",
      workspaceTwoLifecycleListener
    );
    const unsubscribeAllWorkspaceEvents = facade.subscribeWorkspaceRuntimeToolLifecycleEvents(
      null,
      allWorkspaceLifecycleListener
    );
    const unsubscribeSnapshot = facade.subscribeRuntimeToolLifecycleSnapshot(snapshotListener);
    const unsubscribeWorkspaceOne = facade.subscribeWorkspaceRuntimeToolLifecycleSnapshot(
      "workspace-1",
      workspaceOneSnapshotListener
    );
    const unsubscribeWorkspaceTwo = facade.subscribeWorkspaceRuntimeToolLifecycleSnapshot(
      "workspace-2",
      workspaceTwoSnapshotListener
    );
    const unsubscribeAllWorkspaces = facade.subscribeWorkspaceRuntimeToolLifecycleSnapshot(
      null,
      allWorkspaceSnapshotListener
    );

    expect(events.subscribeAppServerEvents).toHaveBeenCalledTimes(1);
    expect(telemetry.subscribeRuntimeToolExecutionTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(events.__appServerListenerCount()).toBe(1);
    expect(telemetry.__telemetryListenerCount()).toBe(1);

    events.__emitAppServerEvent({
      workspace_id: "workspace-1",
      message: {
        id: "req-tool-1",
        method: "item/started",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "tool-call-1",
          item: {
            id: "tool-call-1",
            type: "mcpToolCall",
            tool: "bash",
            status: "inProgress",
          },
        },
      },
    });

    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "execution",
      phase: "completed",
      toolName: "bash",
      scope: "write",
      at: 250,
      workspaceId: "workspace-1",
      status: "success",
      requestId: "req-tool-1",
    });

    expect(lifecycleListener).toHaveBeenCalledTimes(2);
    expect(workspaceOneLifecycleListener).toHaveBeenCalledTimes(2);
    expect(workspaceTwoLifecycleListener).not.toHaveBeenCalled();
    expect(allWorkspaceLifecycleListener).toHaveBeenCalledTimes(2);
    expect(snapshotListener).toHaveBeenCalledTimes(2);
    expect(workspaceOneSnapshotListener).toHaveBeenCalledTimes(2);
    expect(workspaceTwoSnapshotListener).not.toHaveBeenCalled();
    expect(allWorkspaceSnapshotListener).toHaveBeenCalledTimes(2);
    expect(facade.getRuntimeToolLifecycleSnapshot()).toMatchObject({
      revision: 2,
      lastEvent: {
        kind: "tool",
        source: "telemetry",
        phase: "completed",
        toolName: "bash",
        status: "success",
      },
      recentEvents: [
        expect.objectContaining({
          kind: "tool",
          source: "app-event",
          phase: "started",
          toolName: "bash",
          toolCallId: "tool-call-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          status: "in_progress",
        }),
        expect.objectContaining({
          kind: "tool",
          source: "telemetry",
          phase: "completed",
          toolName: "bash",
          workspaceId: "workspace-1",
          status: "success",
        }),
      ],
    });
    expect(facade.getWorkspaceRuntimeToolLifecycleSnapshot("workspace-1")).toMatchObject({
      revision: 2,
      lastEvent: expect.objectContaining({
        workspaceId: "workspace-1",
        toolName: "bash",
      }),
      recentEvents: [
        expect.objectContaining({
          workspaceId: "workspace-1",
          toolName: "bash",
        }),
        expect.objectContaining({
          workspaceId: "workspace-1",
          toolName: "bash",
        }),
      ],
    });
    expect(facade.getWorkspaceRuntimeToolLifecycleSnapshot("workspace-2")).toMatchObject({
      revision: 2,
      lastEvent: null,
      recentEvents: [],
    });

    unsubscribeEvents();
    expect(events.__appServerListenerCount()).toBe(1);
    expect(telemetry.__telemetryListenerCount()).toBe(1);

    unsubscribeSnapshot();
    unsubscribeWorkspaceOneEvents();
    unsubscribeWorkspaceTwoEvents();
    unsubscribeAllWorkspaceEvents();
    unsubscribeWorkspaceOne();
    unsubscribeWorkspaceTwo();
    unsubscribeAllWorkspaces();
    expect(events.__appServerListenerCount()).toBe(0);
    expect(telemetry.__telemetryListenerCount()).toBe(0);
  });

  it("normalizes turn, approval, and guardrail lifecycle events into the shared vocabulary", async () => {
    const facade = await import("./runtimeToolLifecycleFacade");
    const events = (await import("../ports/events")) as unknown as EventsTestApi;
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;

    const lifecycleListener = vi.fn();
    const unsubscribe = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);

    events.__emitAppServerEvent({
      workspace_id: "workspace-2",
      message: {
        id: "req-turn-2",
        method: "turn/started",
        params: {
          threadId: "thread-2",
          turnId: "turn-2",
        },
      },
    });
    events.__emitAppServerEvent({
      workspace_id: "workspace-2",
      message: {
        id: "approval-2",
        method: "runtime/requestApproval",
        params: {
          threadId: "thread-2",
          turnId: "turn-2",
          approvalId: "approval-2",
          action: "bash",
          reason: "Need approval",
        },
      },
    });
    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "guardrail_evaluated",
      toolName: "bash",
      scope: "write",
      at: 300,
      workspaceId: "workspace-2",
      status: "blocked",
      requestId: "req-turn-2",
      result: {
        allowed: false,
        blockReason: "payload_too_large",
      },
      errorCode: "runtime.validation.payload_too_large",
    });

    expect(lifecycleListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: "turn",
        phase: "started",
        source: "app-event",
        workspaceId: "workspace-2",
        threadId: "thread-2",
        turnId: "turn-2",
        status: "in_progress",
      })
    );
    expect(lifecycleListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: "approval",
        phase: "requested",
        source: "app-event",
        workspaceId: "workspace-2",
        threadId: "thread-2",
        turnId: "turn-2",
        status: "pending",
        approvalId: "approval-2",
      })
    );
    expect(lifecycleListener).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        kind: "guardrail",
        phase: "evaluated",
        source: "telemetry",
        workspaceId: "workspace-2",
        toolName: "bash",
        status: "blocked",
        errorCode: "runtime.validation.payload_too_large",
        guardrailDecision: "blocked",
      })
    );

    unsubscribe();
  });

  it("drops approval and guardrail statuses that are outside the narrowed lifecycle subsets", async () => {
    const facade = await import("./runtimeToolLifecycleFacade");
    const events = (await import("../ports/events")) as unknown as EventsTestApi;
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;

    const lifecycleListener = vi.fn();
    const unsubscribe = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);

    events.__emitAppServerEvent({
      workspace_id: "workspace-3",
      message: {
        id: "approval-3",
        method: "runtime/approvalResolved",
        params: {
          threadId: "thread-3",
          turnId: "turn-3",
          approvalId: "approval-3",
          status: "failed",
        },
      },
    });
    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "guardrail_outcome",
      toolName: "bash",
      scope: "write",
      at: 400,
      workspaceId: "workspace-3",
      status: "failed",
      requestId: "req-turn-3",
      errorCode: "runtime.tool.failed",
    });

    expect(lifecycleListener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("drops retrograde lifecycle transitions and publishes derived hook checkpoints", async () => {
    const facade = await import("./runtimeToolLifecycleFacade");
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;

    const lifecycleListener = vi.fn();
    const unsubscribe = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);

    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "execution",
      phase: "completed",
      toolName: "bash",
      scope: "write",
      at: 500,
      workspaceId: "workspace-4",
      status: "success",
      requestId: "req-tool-4",
    });
    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "execution",
      phase: "started",
      toolName: "bash",
      scope: "write",
      at: 501,
      workspaceId: "workspace-4",
      status: null,
      requestId: "req-tool-4",
    });

    expect(lifecycleListener).toHaveBeenCalledTimes(1);
    expect(facade.getRuntimeToolLifecycleSnapshot()).toMatchObject({
      revision: 1,
      recentEvents: [
        expect.objectContaining({
          kind: "tool",
          phase: "completed",
          correlationKey: "req-tool-4",
        }),
      ],
      recentHookCheckpoints: [
        expect.objectContaining({
          point: "post_execution_pre_publication",
          status: "ready",
          toolName: "bash",
        }),
      ],
      lastHookCheckpoint: expect.objectContaining({
        point: "post_execution_pre_publication",
        status: "ready",
      }),
    });

    unsubscribe();
  });

  it("keeps repeated telemetry executions distinct when request ids are missing", async () => {
    const facade = await import("./runtimeToolLifecycleFacade");
    const telemetry =
      (await import("../ports/runtimeToolExecutionTelemetry")) as unknown as TelemetryTestApi;

    const lifecycleListener = vi.fn();
    const unsubscribe = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);

    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "execution",
      phase: "completed",
      toolName: "bash",
      scope: "write",
      at: 600,
      workspaceId: "workspace-5",
      status: "success",
    });
    telemetry.__emitRuntimeToolExecutionTelemetryEvent({
      kind: "execution",
      phase: "completed",
      toolName: "bash",
      scope: "write",
      at: 700,
      workspaceId: "workspace-5",
      status: "success",
    });

    expect(lifecycleListener).toHaveBeenCalledTimes(2);
    expect(facade.getRuntimeToolLifecycleSnapshot()).toMatchObject({
      revision: 2,
      recentEvents: [
        expect.objectContaining({
          kind: "tool",
          phase: "completed",
          at: 600,
        }),
        expect.objectContaining({
          kind: "tool",
          phase: "completed",
          at: 700,
        }),
      ],
    });

    unsubscribe();
  });
});
