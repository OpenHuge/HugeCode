// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNativeStateFabricUpdatedAppServerEvent,
  createRuntimeUpdatedEventFixture,
} from "../../../test/runtimeUpdatedEventFixtures";
import { createRuntimeUpdatedSubscriptionHarness } from "../../../test/runtimeUpdatedSubscriptionHarness";
import type { WorkspaceInfo } from "../../../types";
import { getSkillsList } from "../ports/tauriSkills";
import {
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../ports/runtimeUpdatedEvents";
import { useRuntimeInstructionSkillsFacade } from "./runtimeInstructionSkillsFacade";

vi.mock("../ports/tauriSkills", () => ({
  getSkillsList: vi.fn(),
  getInstructionSkill: vi.fn(),
}));

vi.mock("../ports/runtimeUpdatedEvents", async () => {
  const actual = await vi.importActual("../ports/runtimeUpdatedEvents");
  return {
    ...actual,
    useScopedRuntimeUpdatedEvent: vi.fn(),
  };
});

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const secondaryWorkspace: WorkspaceInfo = {
  id: "workspace-2",
  name: "Workspace Two",
  path: "/tmp/workspace-two",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const runtimeUpdatedHarness = createRuntimeUpdatedSubscriptionHarness();
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

beforeEach(() => {
  runtimeUpdatedHarness.reset();
  runtimeUpdatedRevisionCounter = 0;
  vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation((options) => {
    const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
      EMPTY_RUNTIME_UPDATED_SNAPSHOT
    );

    useEffect(() => {
      if (options.enabled === false) {
        setSnapshot(EMPTY_RUNTIME_UPDATED_SNAPSHOT);
        return;
      }
      return runtimeUpdatedHarness.subscribeScopedRuntimeUpdatedEvents(options, (event) => {
        runtimeUpdatedRevisionCounter += 1;
        setSnapshot({
          revision: runtimeUpdatedRevisionCounter,
          lastEvent: event,
        });
      });
    }, [options.enabled, options.scopes, options.workspaceId]);

    return snapshot;
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("useRuntimeInstructionSkillsFacade", () => {
  it("refreshes skills on native state fabric skills updates", async () => {
    vi.mocked(getSkillsList)
      .mockResolvedValueOnce({ result: { skills: [{ name: "first", path: "/skills/first" }] } })
      .mockResolvedValueOnce({
        result: {
          skills: [
            { name: "first", path: "/skills/first" },
            { name: "second", path: "/skills/second" },
          ],
        },
      });

    const { result } = renderHook(() =>
      useRuntimeInstructionSkillsFacade({
        workspaceId: workspace.id,
        isConnected: true,
      })
    );

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledTimes(1);
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["first"]);
    });

    act(() => {
      const event = createNativeStateFabricUpdatedAppServerEvent({
        paramsWorkspaceId: workspace.id,
        scopeKind: "skills",
        changeKind: "skillsCatalogPatched",
      });
      runtimeUpdatedHarness.emitRuntimeUpdated({
        event,
        params: event.message.params as Record<string, unknown>,
        scope: ["skills"],
        reason: "skillsCatalogPatched",
        eventWorkspaceId: event.workspace_id,
        paramsWorkspaceId: workspace.id,
        isWorkspaceLocalEvent: false,
      });
    });

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledTimes(2);
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["first", "second"]);
    });
  });

  it("refreshes when the active workspace changes", async () => {
    vi.mocked(getSkillsList)
      .mockResolvedValueOnce({
        result: { skills: [{ name: "first", path: "/skills/first" }] },
      })
      .mockResolvedValueOnce({
        result: { skills: [{ name: "second", path: "/skills/second" }] },
      });

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string | null }) =>
        useRuntimeInstructionSkillsFacade({
          workspaceId,
          isConnected: true,
        }),
      {
        initialProps: { workspaceId: workspace.id },
      }
    );

    await waitFor(() => {
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["first"]);
    });

    rerender({ workspaceId: secondaryWorkspace.id });

    await waitFor(() => {
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["second"]);
    });
  });

  it("refreshes on runtime updated plugin scope changes", async () => {
    vi.mocked(getSkillsList)
      .mockResolvedValueOnce({
        result: { skills: [{ name: "first", path: "/skills/first" }] },
      })
      .mockResolvedValueOnce({
        result: { skills: [{ name: "second", path: "/skills/second" }] },
      });

    const { result } = renderHook(() =>
      useRuntimeInstructionSkillsFacade({
        workspaceId: workspace.id,
        isConnected: true,
      })
    );

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledTimes(1);
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["first"]);
    });

    act(() => {
      runtimeUpdatedHarness.emitRuntimeUpdated(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: workspace.id,
          revision: "46",
          scope: ["plugins"],
          reason: "code_extension_set_state_v2",
        })
      );
    });

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledTimes(2);
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["second"]);
    });
  });

  it("ignores unrelated runtime compatibility events", async () => {
    vi.mocked(getSkillsList)
      .mockResolvedValueOnce({
        result: { skills: [{ name: "first", path: "/skills/first" }] },
      })
      .mockResolvedValueOnce({
        result: { skills: [{ name: "second", path: "/skills/second" }] },
      });

    const { result } = renderHook(() =>
      useRuntimeInstructionSkillsFacade({
        workspaceId: workspace.id,
        isConnected: true,
      })
    );

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledTimes(1);
      expect(result.current.skills.map((skill) => skill.name)).toEqual(["first"]);
    });

    act(() => {
      runtimeUpdatedHarness.emitRuntimeUpdated(
        createRuntimeUpdatedEventFixture({
          paramsWorkspaceId: workspace.id,
          revision: "47",
          scope: ["threads"],
          reason: "code_thread_live_subscribe",
        })
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getSkillsList).toHaveBeenCalledTimes(1);
    expect(result.current.skills.map((skill) => skill.name)).toEqual(["first"]);
  });
});
