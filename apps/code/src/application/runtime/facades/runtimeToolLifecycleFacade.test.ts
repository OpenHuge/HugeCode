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
    const snapshotListener = vi.fn();

    const unsubscribeEvents = facade.subscribeRuntimeToolLifecycleEvents(lifecycleListener);
    const unsubscribeSnapshot = facade.subscribeRuntimeToolLifecycleSnapshot(snapshotListener);

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
    expect(snapshotListener).toHaveBeenCalledTimes(2);
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

    unsubscribeEvents();
    expect(events.__appServerListenerCount()).toBe(1);
    expect(telemetry.__telemetryListenerCount()).toBe(1);

    unsubscribeSnapshot();
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
});
