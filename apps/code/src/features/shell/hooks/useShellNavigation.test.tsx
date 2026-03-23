import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useShellNavigation } from "./useShellNavigation";

describe("useShellNavigation", () => {
  it("defaults desktop navigation to the workspaces tab", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({
        activeWorkspace: null,
        layoutMode: "desktop",
      })
    );

    await waitFor(() => {
      expect(result.current.activeTab).toBe("workspaces");
    });
  });

  it("allows the settings tab on phone when no workspace is selected", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({
        activeWorkspace: null,
        layoutMode: "phone",
        initialTab: "settings",
      })
    );

    await waitFor(() => {
      expect(result.current.activeTab).toBe("settings");
    });
  });

  it("redirects missions to home on phone when no workspace is selected", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({
        activeWorkspace: null,
        layoutMode: "phone",
        initialTab: "missions",
      })
    );

    await waitFor(() => {
      expect(result.current.activeTab).toBe("home");
    });
  });

  it("normalizes tab writes on phone without workspace", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({
        activeWorkspace: null,
        layoutMode: "phone",
        initialTab: "home",
      })
    );

    result.current.setActiveTab("review");
    await waitFor(() => {
      expect(result.current.activeTab).toBe("home");
    });
  });

  it("re-normalizes active tab when workspace is removed on phone", async () => {
    const connectedWorkspace: WorkspaceInfo = {
      id: "workspace-1",
      name: "Workspace 1",
      path: "/tmp/workspace-1",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };
    const initialProps: { activeWorkspace: WorkspaceInfo | null } = {
      activeWorkspace: connectedWorkspace,
    };
    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useShellNavigation({
          activeWorkspace,
          layoutMode: "phone",
          initialTab: "missions",
        }),
      { initialProps }
    );

    await waitFor(() => {
      expect(result.current.activeTab).toBe("missions");
    });

    rerender({ activeWorkspace: null });
    await waitFor(() => {
      expect(result.current.activeTab).toBe("home");
    });
  });
});
