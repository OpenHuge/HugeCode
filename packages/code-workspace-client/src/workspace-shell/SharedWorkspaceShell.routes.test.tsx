// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { WorkspaceShellApp } from "./WorkspaceShellApp";
import type { MissionControlSnapshot } from "./sharedWorkspaceShellTestHarness";
import { createBindings } from "./sharedWorkspaceShellTestHarness";

describe("WorkspaceShellApp routes", () => {
  it("shows loading copy instead of misleading zeroed mission counts while runtime summary is deferred", () => {
    vi.useFakeTimers();

    try {
      const { unmount } = render(
        <WorkspaceClientBindingsProvider
          bindings={createBindings({
            readMissionControlSnapshot: vi.fn(
              () => new Promise<MissionControlSnapshot>(() => undefined)
            ),
          })}
        >
          <WorkspaceShellApp />
        </WorkspaceClientBindingsProvider>
      );

      expect(
        screen.getByText(
          "Runtime summary is loading in the background so the shared shell can render immediately."
        )
      ).toBeTruthy();
      expect(screen.getByText("Hydrating shell")).toBeTruthy();
      expect(screen.getByText("Runtime activity is loading in the background.")).toBeTruthy();
      expect(
        screen.getByText("Review signals load after the shell becomes interactive.")
      ).toBeTruthy();
      expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(
        false
      );

      act(() => {
        unmount();
      });
      vi.clearAllTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders workspace catalog and mission summary from shared bindings", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    expect(await screen.findByRole("heading", { name: "Home" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Alpha/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Beta/i })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Browse the shared workspace roster" })
    ).toBeTruthy();
    expect(screen.getByText("2 workspaces")).toBeTruthy();
    expect(screen.getByText("Launch readiness")).toBeTruthy();
    expect(screen.getByText("Continuity readiness")).toBeTruthy();
    expect(screen.getByText("Operator next")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Workspace sections" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Workspaces" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Missions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  }, 15_000);

  it("keeps an explicit workspace route scoped while the roster is still hydrating", async () => {
    vi.useFakeTimers();

    try {
      render(
        <WorkspaceClientBindingsProvider
          bindings={createBindings({
            initialSelection: { kind: "workspace", workspaceId: "workspace-2" },
            listWorkspaces: vi.fn(
              () => new Promise<{ id: string; name: string; connected: boolean }[]>(() => undefined)
            ),
          })}
        >
          <WorkspaceShellApp />
        </WorkspaceClientBindingsProvider>
      );

      expect(screen.getByText("Loading selected workspace...")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByRole("heading", { level: 2, name: "Beta" })).toBeTruthy();
      expect(
        screen.getAllByText("The selected workspace is not connected to the runtime.").length
      ).toBeGreaterThan(0);
      expect(screen.getByRole("heading", { level: 1, name: "Workspaces" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns to home when an explicit workspace route resolves as invalid", async () => {
    let resolveCatalog:
      | ((value: { id: string; name: string; connected: boolean }[]) => void)
      | null = null;

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          initialSelection: { kind: "workspace", workspaceId: "workspace-2" },
          listWorkspaces: vi.fn(
            () =>
              new Promise<{ id: string; name: string; connected: boolean }[]>((resolve) => {
                resolveCatalog = resolve;
              })
          ),
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    expect(screen.getByText("Loading selected workspace...")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Workspaces" })).toBeTruthy();

    await act(async () => {
      resolveCatalog?.([{ id: "workspace-1", name: "Alpha", connected: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
      expect(screen.getByText("Home overview")).toBeTruthy();
    });
  });

  it("updates the mission summary when selecting another workspace", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: /Beta/i });
    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    fireEvent.click(screen.getByRole("button", { name: /Beta/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Beta" })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1, name: "Workspaces" })).toBeTruthy();
    const launchCard = screen.getByText("Launch readiness").closest("article");
    expect(launchCard).toBeTruthy();
    expect(
      within(launchCard as HTMLElement).getByText(
        "The selected workspace is not connected to the runtime."
      )
    ).toBeTruthy();
  }, 15_000);

  it("renders settings framing as a shared control-plane section", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Control-plane settings" })
    ).toBeTruthy();
    expect(
      screen.getByText("Appearance, projects, runtime, and Codex defaults for this app.")
    ).toBeTruthy();
    expect(screen.getByText("Desktop app")).toBeTruthy();
  });

  it("surfaces deferred desktop host startup status once the shared shell hydrates", async () => {
    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          hostPlatform: "desktop",
          readStartupStatus: vi.fn(async () => ({
            tone: "attention",
            label: "Electron updates need attention",
            detail: "Manual updates are required for this build.",
          })),
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    expect(
      screen.getByText("Desktop host capabilities are hydrating after shell startup.")
    ).toBeTruthy();
    expect(await screen.findByText("Electron updates need attention")).toBeTruthy();
    expect(screen.getByText("Manual updates are required for this build.")).toBeTruthy();
  });

  it("keeps the workspace roster visible while a manual refresh is in flight", async () => {
    let resolveWorkspaceRefresh:
      | ((value: { id: string; name: string; connected: boolean }[]) => void)
      | null = null;
    const listWorkspaces = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta", connected: false },
      ])
      .mockImplementationOnce(
        () =>
          new Promise<{ id: string; name: string; connected: boolean }[]>((resolve) => {
            resolveWorkspaceRefresh = resolve;
          })
      );

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings({ listWorkspaces })}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    expect(await screen.findByRole("button", { name: /Alpha/i })).toBeTruthy();
    expect(screen.getByText("2 workspaces")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(screen.getByText("Refreshing shell")).toBeTruthy();
    expect(screen.getByText("Refreshing workspace roster")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refreshing..." })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Refreshing..." }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByRole("button", { name: /Alpha/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Beta/i })).toBeTruthy();

    await act(async () => {
      resolveWorkspaceRefresh?.([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta", connected: false },
        { id: "workspace-3", name: "Gamma", connected: true },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("3 workspaces")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    });
  }, 15_000);

  it("surfaces shared-shell load failures through toast cards instead of inline copy", async () => {
    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          workspaceCatalogError: "Workspace catalog failed",
          missionControlError: "Mission summary failed",
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("alert")).toHaveLength(2);
    });
    expect(screen.getByText("Workspace roster unavailable")).toBeTruthy();
    expect(screen.getByText("Mission summary unavailable")).toBeTruthy();
    expect(screen.getByText("Workspace catalog failed")).toBeTruthy();
    expect(screen.getByText("Mission summary failed")).toBeTruthy();
  });
});
