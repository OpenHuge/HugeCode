// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type RuntimeUpdatedEvent,
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import type { DebugEntry } from "../../../types";
import { useRuntimeUpdatedRefresh } from "./useRuntimeUpdatedRefresh";

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

describe("useRuntimeUpdatedRefresh", () => {
  let listener: ((event: RuntimeUpdatedEvent) => void) | null = null;
  let revisionCounter = 0;
  const EMPTY_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
    revision: 0,
    lastEvent: null,
  };

  beforeEach(() => {
    listener = null;
    revisionCounter = 0;
    vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation(() => {
      const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(EMPTY_SNAPSHOT);

      useEffect(() => {
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
      }, []);

      return snapshot;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("subscribes with the requested scopes and triggers debug plus refresh", async () => {
    const onRefresh = vi.fn();
    const onDebug = vi.fn<(entry: DebugEntry) => void>();

    renderHook(() =>
      useRuntimeUpdatedRefresh({
        workspaceId: "workspace-1",
        scopes: ["bootstrap", "models"],
        onRefresh,
        onDebug,
        debugLabel: "runtime/updated models refresh",
      })
    );

    expect(useScopedRuntimeUpdatedEvent).toHaveBeenCalledWith({
      enabled: true,
      workspaceId: "workspace-1",
      scopes: ["bootstrap", "models"],
    });

    await act(async () => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: "workspace-1",
          scope: ["models"],
          reason: "code_model_refresh",
        })
      );
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "server",
        label: "runtime/updated models refresh",
      })
    );
  });

  it("does not subscribe when disabled", () => {
    renderHook(() =>
      useRuntimeUpdatedRefresh({
        enabled: false,
        scopes: ["bootstrap"],
        onRefresh: vi.fn(),
      })
    );

    expect(useScopedRuntimeUpdatedEvent).toHaveBeenCalledWith({
      enabled: false,
      scopes: ["bootstrap"],
    });
  });

  it("uses the latest refresh callback after rerender", async () => {
    const onDebug = vi.fn<(entry: DebugEntry) => void>();
    const firstRefresh = vi.fn();
    const secondRefresh = vi.fn();

    const { rerender } = renderHook(
      ({ onRefresh }) =>
        useRuntimeUpdatedRefresh({
          scopes: ["bootstrap"],
          onRefresh,
          onDebug,
          debugLabel: "runtime/updated bootstrap refresh",
        }),
      { initialProps: { onRefresh: firstRefresh } }
    );

    rerender({ onRefresh: secondRefresh });

    await act(async () => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          scope: ["bootstrap"],
          reason: "event_stream_lagged",
        })
      );
    });

    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
  });
});
