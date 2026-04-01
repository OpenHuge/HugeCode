// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type RuntimeUpdatedEvent,
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import { useRuntimeWebMcpCatalogRevision } from "./useRuntimeWebMcpCatalogRevision";

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

describe("useRuntimeWebMcpCatalogRevision", () => {
  let listener: ((event: RuntimeUpdatedEvent) => void) | null = null;
  let revisionCounter = 0;
  const EMPTY_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
    revision: 0,
    lastEvent: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    listener = null;
    revisionCounter = 0;
    vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation(({ enabled }) => {
      const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(EMPTY_SNAPSHOT);

      useEffect(() => {
        if (!enabled) {
          listener = null;
          setSnapshot(EMPTY_SNAPSHOT);
          return () => undefined;
        }
        const currentListener = (event: RuntimeUpdatedEvent) => {
          revisionCounter += 1;
          setSnapshot({
            revision: revisionCounter,
            lastEvent: event,
          });
        };
        listener = currentListener;
        return () => {
          if (listener === currentListener) {
            listener = null;
          }
        };
      }, [enabled]);

      return snapshot;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("subscribes to workspace-scoped bootstrap and skills events", () => {
    renderHook(() =>
      useRuntimeWebMcpCatalogRevision({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(useScopedRuntimeUpdatedEvent).toHaveBeenCalledWith({
      enabled: true,
      workspaceId: "workspace-1",
      scopes: ["bootstrap", "skills"],
    });
  });

  it("debounces clustered skills/bootstrap updates into one revision bump", async () => {
    const { result } = renderHook(() =>
      useRuntimeWebMcpCatalogRevision({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(result.current).toBe(0);

    await act(async () => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: "workspace-1",
          scope: ["skills"],
          reason: "skill_refresh_complete",
        })
      );
      listener?.(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: "workspace-1",
          scope: ["bootstrap"],
          reason: "bootstrap_refresh_complete",
        })
      );
    });

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe(1);
  });

  it("ignores events when disabled", async () => {
    const { result } = renderHook(() =>
      useRuntimeWebMcpCatalogRevision({
        workspaceId: "workspace-1",
        enabled: false,
      })
    );

    await act(async () => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: "workspace-1",
          scope: ["skills"],
          reason: "skill_refresh_complete",
        })
      );
      vi.runAllTimers();
    });

    expect(result.current).toBe(0);
  });

  it("ignores unrelated runtime-updated scopes", async () => {
    const { result } = renderHook(() =>
      useRuntimeWebMcpCatalogRevision({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    await act(async () => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: "workspace-1",
          scope: ["threads"],
          reason: "thread_refresh_complete",
        })
      );
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(0);
  });

  it("rebinds when the active workspace changes", () => {
    const { rerender } = renderHook(
      ({ workspaceId }) =>
        useRuntimeWebMcpCatalogRevision({
          workspaceId,
          enabled: true,
        }),
      { initialProps: { workspaceId: "workspace-1" } }
    );

    rerender({ workspaceId: "workspace-2" });

    expect(useScopedRuntimeUpdatedEvent).toHaveBeenLastCalledWith({
      enabled: true,
      workspaceId: "workspace-2",
      scopes: ["bootstrap", "skills"],
    });
  });
});
