// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

const workspace: WorkspaceInfo = {
  id: "ws-restore",
  name: "Restore Workspace",
  path: "/tmp/restore-workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useWorkspaceRestore", () => {
  it("retries thread restoration after a transient failure", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary runtime outage"))
      .mockResolvedValueOnce(undefined);

    const { rerender } = renderHook(
      ({ workspaces, hasLoaded }: { workspaces: WorkspaceInfo[]; hasLoaded: boolean }) =>
        useWorkspaceRestore({
          workspaces,
          hasLoaded,
          connectWorkspace,
          listThreadsForWorkspace,
        }),
      {
        initialProps: {
          workspaces: [workspace],
          hasLoaded: true,
        },
      }
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    rerender({
      workspaces: [{ ...workspace }],
      hasLoaded: true,
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
    });
    expect(connectWorkspace).not.toHaveBeenCalled();
  });

  it("does not start duplicate restore attempts while one is already in flight", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    let resolveListThreads: (() => void) | null = null;
    const listThreadsForWorkspace = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveListThreads = resolve;
        })
    );

    const { rerender } = renderHook(
      ({ workspaces, hasLoaded }: { workspaces: WorkspaceInfo[]; hasLoaded: boolean }) =>
        useWorkspaceRestore({
          workspaces,
          hasLoaded,
          connectWorkspace,
          listThreadsForWorkspace,
        }),
      {
        initialProps: {
          workspaces: [workspace],
          hasLoaded: true,
        },
      }
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    rerender({
      workspaces: [{ ...workspace }],
      hasLoaded: true,
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    resolveListThreads?.();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });
    expect(connectWorkspace).not.toHaveBeenCalled();
  });
});
