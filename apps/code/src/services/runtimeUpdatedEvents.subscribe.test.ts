import { beforeEach, describe, expect, it, vi } from "vitest";

type EventsTestApi = {
  subscribeAppServerEvents: ReturnType<typeof vi.fn>;
  __emitAppServerEvent: (event: unknown) => void;
  __appServerListenerCount: () => number;
  __resetAppServerMock: () => void;
};

vi.mock("./events", () => {
  const listeners = new Set<(event: unknown) => void>();
  const subscribeAppServerEvents = vi.fn((listener: (event: unknown) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });
  return {
    subscribeAppServerEvents,
    __emitAppServerEvent: (event: unknown) => {
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

vi.mock("./logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("subscribeRuntimeUpdatedEvents", () => {
  beforeEach(async () => {
    vi.resetModules();
    const events = await import("./events");
    (events as unknown as EventsTestApi).__resetAppServerMock();
  });

  it("shares one app-server subscription across listeners", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(firstListener);
    const unsubscribeSecond = runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(secondListener);

    expect(eventsApi.subscribeAppServerEvents).toHaveBeenCalledTimes(1);
    expect(eventsApi.__appServerListenerCount()).toBe(1);

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: { scope: ["threads"] },
      },
    });

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(eventsApi.__appServerListenerCount()).toBe(1);

    unsubscribeSecond();
    expect(eventsApi.__appServerListenerCount()).toBe(0);
  });

  it("restarts app-server subscription after becoming idle", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    const listener = vi.fn();
    const unsubscribe = runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(listener);
    unsubscribe();

    runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(listener);

    expect(eventsApi.subscribeAppServerEvents).toHaveBeenCalledTimes(2);
  });

  it("filters runtime updated events by workspace and scope", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    const listener = vi.fn();
    runtimeUpdatedEvents.subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: "workspace-a",
        scopes: ["prompts", "bootstrap"],
      },
      listener
    );

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          workspaceId: "workspace-b",
          scope: ["prompts"],
        },
      },
    });
    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-a",
      message: {
        method: "runtime/updated",
        params: {
          scope: ["threads"],
        },
      },
    });
    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          workspaceId: "workspace-a",
          scope: ["prompts"],
        },
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        eventWorkspaceId: "workspace-local",
        paramsWorkspaceId: "workspace-a",
        scope: ["prompts"],
      })
    );
  });

  it("treats native state fabric updates as runtime-updated events for scope filters", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    const listener = vi.fn();
    runtimeUpdatedEvents.subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: "workspace-a",
        scopes: ["skills"],
      },
      listener
    );

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "native_state_fabric_updated",
        params: {
          revision: 3,
          workspaceId: "workspace-a",
          scopeKind: "skills",
          changeKind: "skillsCatalogPatched",
        },
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        paramsWorkspaceId: "workspace-a",
        scope: ["skills"],
      })
    );
  });

  it("treats native task scope updates as agents events for workspace filters", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    const listener = vi.fn();
    runtimeUpdatedEvents.subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: "workspace-a",
        scopes: ["agents"],
      },
      listener
    );

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "native_state_fabric_updated",
        params: {
          revision: 4,
          workspaceId: "workspace-a",
          scopeKind: "task",
          changeKind: "taskUpsert",
          taskId: "task-1",
        },
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        paramsWorkspaceId: "workspace-a",
        scope: ["agents"],
        reason: "taskUpsert",
      })
    );
  });

  it("evaluates workspace matches against the latest workspace resolver result", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const eventsApi = events as unknown as EventsTestApi;

    let workspaceId = "workspace-a";
    const listener = vi.fn();
    runtimeUpdatedEvents.subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: () => workspaceId,
        scopes: ["threads"],
      },
      listener
    );

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          workspaceId: "workspace-a",
          scope: ["threads"],
        },
      },
    });

    workspaceId = "workspace-b";

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          workspaceId: "workspace-a",
          scope: ["threads"],
        },
      },
    });
    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          workspaceId: "workspace-b",
          scope: ["threads"],
        },
      },
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        paramsWorkspaceId: "workspace-b",
        scope: ["threads"],
      })
    );
  });

  it("isolates listener failures so other runtime-updated subscribers still receive events", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./events");
    const { logger } = await import("./logger");
    const eventsApi = events as unknown as EventsTestApi;

    const failingListener = vi.fn(() => {
      throw new Error("listener exploded");
    });
    const healthyListener = vi.fn();

    runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(failingListener);
    runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(healthyListener);

    eventsApi.__emitAppServerEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: { scope: ["threads"] },
      },
    });

    expect(failingListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[runtimeUpdatedEvents] listener failed",
      expect.any(Error)
    );
  });
});
