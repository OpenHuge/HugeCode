import { describe, expect, it, vi } from "vitest";
import {
  composeSharedWorkspaceShellState,
  deriveSharedWorkspaceShellActiveSection,
  deriveSharedWorkspaceShellBackgroundEnabled,
} from "./sharedWorkspaceShellComposition";

describe("deriveSharedWorkspaceShellActiveSection", () => {
  it("maps route selection kinds to shell sections", () => {
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "none" })).toBe("home");
    expect(
      deriveSharedWorkspaceShellActiveSection({
        kind: "workspace",
        workspaceId: "workspace-1",
      })
    ).toBe("workspaces");
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "missions" })).toBe("missions");
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "review" })).toBe("review");
  });
});

describe("deriveSharedWorkspaceShellBackgroundEnabled", () => {
  it("keeps background hydration enabled for missions and review surfaces", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "missions",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(true);
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "review",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(true);
  });

  it("allows explicit activation and deferred activation to warm background data", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "home",
        activationRequested: true,
        activationDeferred: false,
      })
    ).toBe(true);
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "settings",
        activationRequested: false,
        activationDeferred: true,
      })
    ).toBe(true);
  });

  it("stays disabled for passive sections until background activation is requested", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "home",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(false);
  });
});

describe("composeSharedWorkspaceShellState", () => {
  it("stitches shell frame, data, and actions into a stable shared state shape", () => {
    const refreshWorkspaces = vi.fn(async () => undefined);
    const selectWorkspace = vi.fn();
    const refreshMissionSummary = vi.fn(async () => undefined);
    const refreshHostStartupStatus = vi.fn(async () => undefined);
    const navigateToSection = vi.fn();

    const state = composeSharedWorkspaceShellState({
      runtimeMode: "connected",
      platformHint: "desktop",
      routeSelection: { kind: "workspace", workspaceId: "workspace-1" },
      activeSection: "workspaces",
      catalogState: {
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
        activeWorkspaceId: "workspace-1",
        activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
        hasPendingWorkspaceSelection: false,
        loadState: "ready",
        error: null,
        refresh: refreshWorkspaces,
        selectWorkspace,
      },
      missionControlState: {
        summary: {
          workspaceLabel: "Alpha",
          tasksCount: 1,
          runsCount: 2,
          approvalCount: 1,
          reviewPacksCount: 1,
          connectedWorkspaceCount: 1,
          launchReadiness: {
            tone: "ready",
            label: "Launch readiness",
            detail: "Healthy",
          },
          continuityReadiness: {
            tone: "attention",
            label: "Continuity readiness",
            detail: "Needs review",
          },
          missionItems: [],
          reviewItems: [],
        },
        snapshot: null,
        loadState: "ready",
        error: null,
        refresh: refreshMissionSummary,
      },
      hostStartupState: {
        status: {
          tone: "ready",
          label: "Desktop host",
          detail: "Healthy",
        },
        loadState: "ready",
        error: null,
        refresh: refreshHostStartupStatus,
      },
      navigateToSection,
      accountHref: "/account",
      settingsFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    });

    expect(state.activeSection).toBe("workspaces");
    expect(state.activeWorkspace?.name).toBe("Alpha");
    expect(state.refreshWorkspaces).toBe(refreshWorkspaces);
    expect(state.selectWorkspace).toBe(selectWorkspace);
    expect(state.refreshMissionSummary).toBe(refreshMissionSummary);
    expect(state.refreshHostStartupStatus).toBe(refreshHostStartupStatus);
    expect(state.navigateToSection).toBe(navigateToSection);
    expect(state.missionSummary.workspaceLabel).toBe("Alpha");
    expect(state.accountHref).toBe("/account");
  });
});
