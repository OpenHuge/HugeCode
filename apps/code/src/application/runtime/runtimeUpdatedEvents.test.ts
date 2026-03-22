import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNativeStateFabricUpdatedAppServerEvent,
  createRuntimeUpdatedAppServerEvent,
} from "../../test/runtimeUpdatedEventFixtures";

type EventsTestApi = {
  subscribeAppServerEvents: ReturnType<typeof vi.fn>;
  __emitAppServerEvent: (event: unknown) => void;
  __appServerListenerCount: () => number;
  __resetAppServerMock: () => void;
};

vi.mock("./ports/events", () => {
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

describe("application/runtime/runtimeUpdatedEvents", () => {
  beforeEach(async () => {
    vi.resetModules();
    const events = await import("./ports/events");
    (events as unknown as EventsTestApi).__resetAppServerMock();
  });

  it("shares one app-server subscription across listeners", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./ports/events");
    const eventsApi = events as unknown as EventsTestApi;

    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(firstListener);
    const unsubscribeSecond = runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(secondListener);

    expect(eventsApi.subscribeAppServerEvents).toHaveBeenCalledTimes(1);
    expect(eventsApi.__appServerListenerCount()).toBe(1);

    eventsApi.__emitAppServerEvent(createRuntimeUpdatedAppServerEvent());

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(eventsApi.__appServerListenerCount()).toBe(1);

    unsubscribeSecond();
    expect(eventsApi.__appServerListenerCount()).toBe(0);
  });

  it("updates the runtime-updated snapshot when app events arrive", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./ports/events");
    const eventsApi = events as unknown as EventsTestApi;
    const onSnapshot = vi.fn();
    const unsubscribeSnapshot = runtimeUpdatedEvents.subscribeRuntimeUpdatedSnapshot(onSnapshot);

    expect(runtimeUpdatedEvents.getRuntimeUpdatedSnapshot()).toEqual({
      revision: 0,
      lastEvent: null,
    });

    const runtimeUpdatedEvent = createRuntimeUpdatedAppServerEvent({
      scope: ["workspaces"],
      reason: "code_workspace_create",
      revision: "snapshot-1",
    });

    eventsApi.__emitAppServerEvent(runtimeUpdatedEvent);

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(runtimeUpdatedEvents.getRuntimeUpdatedSnapshot()).toMatchObject({
      revision: 1,
      lastEvent: {
        reason: "code_workspace_create",
        scope: ["workspaces"],
      },
    });

    unsubscribeSnapshot();
    expect(eventsApi.__appServerListenerCount()).toBe(0);
  });

  it("publishes native state fabric updates through the shared snapshot store", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./ports/events");
    const eventsApi = events as unknown as EventsTestApi;
    const onSnapshot = vi.fn();
    const unsubscribeSnapshot = runtimeUpdatedEvents.subscribeRuntimeUpdatedSnapshot(onSnapshot);

    eventsApi.__emitAppServerEvent(
      createNativeStateFabricUpdatedAppServerEvent({
        paramsWorkspaceId: "workspace-2",
        scopeKind: "workspace",
        changeKind: "workspaceUpsert",
        revision: 2,
      })
    );

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(runtimeUpdatedEvents.getRuntimeUpdatedSnapshot()).toMatchObject({
      revision: 1,
      lastEvent: {
        reason: "workspaceUpsert",
        scope: ["bootstrap", "workspaces"],
        paramsWorkspaceId: "workspace-2",
      },
    });

    unsubscribeSnapshot();
  });

  it("publishes native task scope updates through the shared snapshot store as agents scope", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./ports/events");
    const eventsApi = events as unknown as EventsTestApi;
    const onSnapshot = vi.fn();
    const unsubscribeSnapshot = runtimeUpdatedEvents.subscribeRuntimeUpdatedSnapshot(onSnapshot);

    eventsApi.__emitAppServerEvent(
      createNativeStateFabricUpdatedAppServerEvent({
        paramsWorkspaceId: "workspace-2",
        scopeKind: "task",
        changeKind: "taskUpsert",
        revision: 3,
      })
    );

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(runtimeUpdatedEvents.getRuntimeUpdatedSnapshot()).toMatchObject({
      revision: 1,
      lastEvent: {
        reason: "taskUpsert",
        scope: ["agents"],
        paramsWorkspaceId: "workspace-2",
      },
    });

    unsubscribeSnapshot();
  });

  it("isolates listener failures so later listeners and snapshots still update", async () => {
    const runtimeUpdatedEvents = await import("./runtimeUpdatedEvents");
    const events = await import("./ports/events");
    const { logger } = await import("./logger");
    const eventsApi = events as unknown as EventsTestApi;

    const failingListener = vi.fn(() => {
      throw new Error("runtime listener failed");
    });
    const healthyListener = vi.fn();
    const snapshotListener = vi.fn();

    runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(failingListener);
    runtimeUpdatedEvents.subscribeRuntimeUpdatedEvents(healthyListener);
    runtimeUpdatedEvents.subscribeRuntimeUpdatedSnapshot(snapshotListener);

    eventsApi.__emitAppServerEvent(
      createRuntimeUpdatedAppServerEvent({
        scope: ["threads"],
        reason: "fanout-recovery",
        revision: "fanout-1",
      })
    );

    expect(failingListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(snapshotListener).toHaveBeenCalledTimes(1);
    expect(runtimeUpdatedEvents.getRuntimeUpdatedSnapshot()).toMatchObject({
      revision: 1,
      lastEvent: {
        reason: "fanout-recovery",
        scope: ["threads"],
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      "[RuntimeUpdatedStore] listener failed",
      expect.any(Error)
    );
  });
});
