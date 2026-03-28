import { describe, expect, it, vi } from "vitest";
import {
  composeSharedWorkspaceShellState,
  deriveSharedWorkspaceShellActiveSection,
  deriveSharedWorkspaceShellBackgroundEnabled,
  deriveSharedWorkspaceShellErrors,
  deriveSharedWorkspaceShellFocusedItemIds,
  deriveSharedWorkspaceShellFrameState,
  deriveSharedWorkspaceShellRefreshLabel,
  deriveSharedWorkspaceShellUiState,
  deriveSharedWorkspaceShellVisibleErrors,
  deriveSharedWorkspaceShellWorkspaceSelectOptions,
  reconcileSharedWorkspaceShellDismissedErrors,
  resolveSharedWorkspaceShellFocusTarget,
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

describe("deriveSharedWorkspaceShellFrameState", () => {
  it("derives a stable shell frame from route and activation inputs", () => {
    const frameState = deriveSharedWorkspaceShellFrameState({
      runtimeMode: "connected",
      platformHint: "desktop",
      routeSelection: { kind: "workspace", workspaceId: "workspace-1" },
      activationRequested: false,
      activationDeferred: true,
      accountHref: "/account",
      settingsFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    });

    expect(frameState).toMatchObject({
      runtimeMode: "connected",
      platformHint: "desktop",
      activeSection: "workspaces",
      backgroundEnabled: true,
      accountHref: "/account",
    });
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
      frameState: {
        runtimeMode: "connected",
        platformHint: "desktop",
        routeSelection: { kind: "workspace", workspaceId: "workspace-1" },
        activeSection: "workspaces",
        backgroundEnabled: true,
        accountHref: "/account",
        settingsFraming: {
          kickerLabel: "Preferences",
          contextLabel: "Desktop app",
          title: "Settings",
          subtitle: "Workspace settings",
        },
      },
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

describe("shell ui derivation helpers", () => {
  it("derives workspace select options with a pending placeholder", () => {
    expect(
      deriveSharedWorkspaceShellWorkspaceSelectOptions({
        activeWorkspaceId: "workspace-2",
        hasPendingWorkspaceSelection: true,
        workspaceLoadState: "loading",
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
      })
    ).toEqual([
      { value: "__home__", label: "Home overview" },
      {
        value: "workspace-2",
        label: "Loading selected workspace...",
        disabled: true,
      },
      { value: "workspace-1", label: "Alpha" },
    ]);
  });

  it("derives shell errors and reconciles dismissed ids against active errors", () => {
    const errors = deriveSharedWorkspaceShellErrors({
      workspaceError: "Workspace failed",
      missionError: null,
      hostStartupError: "Host failed",
    });

    expect(errors.map((error) => error.id)).toEqual([
      "workspace:Workspace failed",
      "host:Host failed",
    ]);
    expect(
      reconcileSharedWorkspaceShellDismissedErrors(["gone", "host:Host failed"], errors)
    ).toEqual(["host:Host failed"]);
    expect(deriveSharedWorkspaceShellVisibleErrors(errors, ["host:Host failed"])).toEqual([
      errors[0],
    ]);
  });

  it("resolves pending focus targets and derives focused ids", () => {
    const resolvedFocusTarget = resolveSharedWorkspaceShellFocusTarget({
      focusTarget: { section: "review", itemId: null },
      missionLoadState: "ready",
      missionItemIds: ["mission-1"],
      reviewItemIds: ["review-1", "review-2"],
    });

    expect(resolvedFocusTarget).toEqual({
      section: "review",
      itemId: "review-1",
    });
    expect(
      deriveSharedWorkspaceShellFocusedItemIds({
        focusTarget: resolvedFocusTarget,
        missionItemIds: ["mission-1"],
        reviewItemIds: ["review-1", "review-2"],
      })
    ).toEqual({
      focusedMissionId: null,
      focusedReviewId: "review-1",
    });
  });

  it("derives shell refresh state and the aggregate ui state", () => {
    expect(
      deriveSharedWorkspaceShellRefreshLabel({
        workspaceLoadState: "ready",
        missionLoadState: "refreshing",
        hostStartupLoadState: "ready",
      })
    ).toEqual({
      shellHydrating: false,
      shellRefreshing: true,
      refreshLabel: "Refreshing shell",
    });

    const shellState = composeSharedWorkspaceShellState({
      frameState: {
        runtimeMode: "connected",
        platformHint: "desktop",
        routeSelection: { kind: "review" },
        activeSection: "review",
        backgroundEnabled: true,
        accountHref: "/account",
        settingsFraming: {
          kickerLabel: "Preferences",
          contextLabel: "Desktop app",
          title: "Settings",
          subtitle: "Workspace settings",
        },
      },
      catalogState: {
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
        activeWorkspaceId: "workspace-1",
        activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
        hasPendingWorkspaceSelection: false,
        loadState: "ready",
        error: "Workspace failed",
        refresh: vi.fn(async () => undefined),
        selectWorkspace: vi.fn(),
      },
      missionControlState: {
        summary: {
          workspaceLabel: "Alpha",
          tasksCount: 0,
          runsCount: 0,
          approvalCount: 0,
          reviewPacksCount: 1,
          connectedWorkspaceCount: 1,
          launchReadiness: { tone: "ready", label: "Launch readiness", detail: "Healthy" },
          continuityReadiness: {
            tone: "attention",
            label: "Continuity readiness",
            detail: "Needs review",
          },
          missionItems: [],
          reviewItems: [
            {
              id: "review-1",
              title: "Review 1",
              workspaceName: "Alpha",
              summary: "Inspect review 1",
              reviewStatusLabel: "Needs attention",
              validationLabel: "Passed",
              warningCount: 0,
              tone: "attention",
            },
          ],
        },
        snapshot: null,
        loadState: "ready",
        error: "Mission failed",
        refresh: vi.fn(async () => undefined),
      },
      hostStartupState: {
        status: null,
        loadState: "refreshing",
        error: "Host failed",
        refresh: vi.fn(async () => undefined),
      },
      navigateToSection: vi.fn(),
    });

    expect(
      deriveSharedWorkspaceShellUiState({
        shellState,
        focusTarget: { section: "review", itemId: null },
        dismissedErrors: ["host:Host failed"],
      })
    ).toMatchObject({
      workspaceSelectValue: "workspace-1",
      focusedMissionId: null,
      focusedReviewId: "review-1",
      shellHydrating: false,
      shellRefreshing: true,
      refreshLabel: "Refreshing shell",
    });
  });
});
