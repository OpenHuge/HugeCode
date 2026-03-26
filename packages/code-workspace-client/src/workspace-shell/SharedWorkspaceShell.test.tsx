// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming, WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { WorkspaceShellApp } from "./WorkspaceShellApp";
import type { SharedWorkspaceRouteSelection } from "./workspaceNavigation";

type MissionControlSnapshot = Awaited<
  ReturnType<WorkspaceClientBindings["runtime"]["missionControl"]["readMissionControlSnapshot"]>
>;

const workspaceShellDir = import.meta.dirname;

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Appearance, projects, runtime, and Codex defaults for this app.",
};

function createBindings(options?: {
  workspaceCatalogError?: string;
  missionControlError?: string;
  readMissionControlSnapshot?: () => Promise<MissionControlSnapshot>;
  hostPlatform?: WorkspaceClientBindings["host"]["platform"];
  readStartupStatus?: WorkspaceClientBindings["host"]["shell"]["readStartupStatus"];
  initialSelection?: SharedWorkspaceRouteSelection;
  listWorkspaces?: WorkspaceClientBindings["runtime"]["workspaceCatalog"]["listWorkspaces"];
}): WorkspaceClientBindings {
  const listeners = new Set<() => void>();
  let selection: SharedWorkspaceRouteSelection = options?.initialSelection ?? { kind: "home" };

  return {
    navigation: {
      readRouteSelection: () => selection,
      subscribeRouteSelection: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      navigateToWorkspace: (workspaceId) => {
        selection = { kind: "workspace", workspaceId };
        listeners.forEach((listener) => listener());
      },
      navigateHome: () => {
        selection = { kind: "home" };
        listeners.forEach((listener) => listener());
      },
      navigateToSection: (section) => {
        selection = { kind: section };
        listeners.forEach((listener) => listener());
      },
      getAccountCenterHref: () => "/account",
    },
    runtimeGateway: {
      readRuntimeMode: () => "connected",
      subscribeRuntimeMode: () => () => undefined,
      discoverLocalRuntimeGatewayTargets: async () => [],
      configureManualWebRuntimeGatewayTarget: () => undefined,
    },
    runtime: {
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: async () => ({}),
        updateAppSettings: async (settings) => settings,
        syncRuntimeGatewayProfileFromAppSettings: () => undefined,
      },
      oauth: {
        listAccounts: async () => [],
        listPools: async () => [],
        listPoolMembers: async () => [],
        getPrimaryAccount: async () => null,
        setPrimaryAccount: async () => {
          throw new Error("not implemented");
        },
        applyPool: async () => undefined,
        bindPoolAccount: async () => undefined,
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async () => null,
        getProvidersCatalog: async () => [],
      },
      models: {
        getModelList: async () => [],
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () => {
          if (options?.listWorkspaces) {
            return options.listWorkspaces();
          }
          if (options?.workspaceCatalogError) {
            throw new Error(options.workspaceCatalogError);
          }
          return [
            { id: "workspace-1", name: "Alpha", connected: true },
            { id: "workspace-2", name: "Beta", connected: false },
          ];
        },
      },
      missionControl: {
        readMissionControlSnapshot: async () => {
          if (options?.readMissionControlSnapshot) {
            return options.readMissionControlSnapshot();
          }
          if (options?.missionControlError) {
            throw new Error(options.missionControlError);
          }
          return {
            source: "runtime_snapshot_v1",
            generatedAt: 0,
            workspaces: [
              {
                id: "workspace-1",
                name: "Alpha",
                rootPath: "/alpha",
                connected: true,
                defaultProfileId: null,
              },
              {
                id: "workspace-2",
                name: "Beta",
                rootPath: "/beta",
                connected: false,
                defaultProfileId: null,
              },
            ],
            tasks: [
              {
                id: "task-1",
                workspaceId: "workspace-1",
                title: "Launch",
                objective: null,
                origin: {
                  kind: "run",
                  threadId: null,
                  runId: "run-1",
                  requestId: null,
                },
                taskSource: null,
                mode: null,
                modeSource: "missing",
                status: "running",
                createdAt: 0,
                updatedAt: 0,
                currentRunId: "run-1",
                latestRunId: "run-1",
                latestRunState: "running",
              },
            ],
            runs: [
              {
                id: "run-1",
                workspaceId: "workspace-1",
                taskId: "task-1",
                state: "running",
                title: "Launch",
                summary: null,
                taskSource: null,
                startedAt: 0,
                finishedAt: null,
                updatedAt: 0,
                currentStepIndex: null,
                placement: {
                  resolvedBackendId: "backend-1",
                  requestedBackendIds: [],
                  resolutionSource: "explicit_preference",
                  lifecycleState: "confirmed",
                  readiness: "ready",
                  healthSummary: "placement_ready",
                  attentionReasons: [],
                  summary: "Ready",
                  rationale: "Healthy",
                },
                approval: {
                  status: "pending_decision",
                  approvalId: "approval-1",
                  label: "Approval pending",
                  summary: "Waiting for approval.",
                },
                checkpoint: {
                  state: "ready",
                  lifecycleState: "active",
                  checkpointId: "checkpoint-1",
                  traceId: "trace-1",
                  recovered: false,
                  updatedAt: 0,
                  resumeReady: true,
                  summary: "Ready to resume",
                },
              },
            ],
            reviewPacks: [
              {
                id: "review-1",
                runId: "run-1",
                taskId: "task-1",
                workspaceId: "workspace-1",
                summary: "Ready for review",
                reviewStatus: "ready",
                evidenceState: "complete",
                validationOutcome: "passed",
                warningCount: 0,
                warnings: [],
                validations: [],
                artifacts: [],
                checksPerformed: [],
                recommendedNextAction: null,
                createdAt: 0,
              },
            ],
          } as unknown as MissionControlSnapshot;
        },
      },
      agentControl: {
        prepareRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        startRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        cancelRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        resumeRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        interveneRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        subscribeRuntimeJob: async () => null,
        listRuntimeJobs: async () => [],
        submitRuntimeJobApprovalDecision: async () => {
          throw new Error("not implemented");
        },
      },
      threads: {
        listThreads: async () => [],
        createThread: async () => ({
          id: "thread-1",
          workspaceId: "workspace-1",
          title: "Thread",
          unread: false,
          running: false,
          createdAt: 0,
          updatedAt: 0,
          provider: "openai",
          modelId: null,
        }),
        resumeThread: async () => null,
        archiveThread: async () => true,
      },
      git: {
        listChanges: async () => ({ staged: [], unstaged: [] }),
        readDiff: async () => null,
        listBranches: async () => ({ currentBranch: "main", branches: [] }),
        createBranch: async () => ({ ok: true, error: null }),
        checkoutBranch: async () => ({ ok: true, error: null }),
        readLog: async () => ({
          total: 0,
          entries: [],
          ahead: 0,
          behind: 0,
          aheadEntries: [],
          behindEntries: [],
          upstream: null,
        }),
        stageChange: async () => ({ ok: true, error: null }),
        stageAll: async () => ({ ok: true, error: null }),
        unstageChange: async () => ({ ok: true, error: null }),
        revertChange: async () => ({ ok: true, error: null }),
        commit: async () => ({ committed: false, committedCount: 0, error: null }),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: async () => [],
        readWorkspaceFile: async () => null,
      },
      review: {
        listReviewPacks: async () => [],
      },
    },
    host: {
      platform: options?.hostPlatform ?? "web",
      intents: {
        openOauthAuthorizationUrl: async () => undefined,
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async () => false,
      },
      notifications: {
        testSound: () => undefined,
        testSystemNotification: () => undefined,
      },
      shell: {
        platformHint: options?.hostPlatform ?? "web",
        readStartupStatus: options?.readStartupStatus,
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: function RuntimeShell() {
        return <div>Runtime shell</div>;
      },
      WorkspaceApp: function WorkspaceSurface() {
        return <div>Workspace surface</div>;
      },
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}

describe("WorkspaceShellApp", () => {
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
      expect(
        (screen.getByRole("button", { name: "Refreshing..." }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(screen.getByText("Runtime activity is loading in the background.")).toBeTruthy();
      expect(
        screen.getByText("Review signals load after the shell becomes interactive.")
      ).toBeTruthy();

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

  it("renders mission and review sections from shared runtime truth", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: "Missions" });
    fireEvent.click(screen.getByRole("button", { name: "Missions" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Mission activity" })).toBeTruthy();
    expect(screen.getByText("Approval pending")).toBeTruthy();
    expect(screen.getByText("Ready to resume")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Review queue" })).toBeTruthy();
    expect(screen.getAllByText("Ready for review").length).toBeGreaterThan(0);
    expect(screen.getByText("Passed")).toBeTruthy();
  });

  it("uses the highest-priority mission and review items in the home overview cards", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-blocked",
                  workspaceId: "workspace-1",
                  title: "Blocked route",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-blocked",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-blocked",
                  latestRunId: "run-blocked",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-blocked",
                  workspaceId: "workspace-1",
                  taskId: "task-blocked",
                  state: "running",
                  title: "Blocked route",
                  summary: "Blocked by routing readiness.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                  placement: {
                    resolvedBackendId: null,
                    requestedBackendIds: [],
                    resolutionSource: "unresolved",
                    lifecycleState: "requested",
                    readiness: "blocked",
                    healthSummary: "blocked",
                    attentionReasons: [],
                    summary: "Blocked by routing readiness.",
                    rationale: null,
                  },
                },
              ],
              reviewPacks: [
                {
                  id: "review-failed",
                  runId: "run-blocked",
                  taskId: "task-blocked",
                  workspaceId: "workspace-1",
                  summary: "Failed review",
                  reviewStatus: "ready",
                  evidenceState: "confirmed",
                  validationOutcome: "failed",
                  warningCount: 0,
                  warnings: [],
                  validations: [],
                  artifacts: [],
                  checksPerformed: [],
                  recommendedNextAction: "Fix the failing validation.",
                  createdAt: 0,
                },
              ],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByText("Routing blocked: Blocked route");
    expect(screen.getByText("Validation failed: Failed review")).toBeTruthy();
  });

  it("renders an operator triage queue on home and focuses the selected mission entry", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-approval",
                  workspaceId: "workspace-1",
                  title: "Await approval",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-approval",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-approval",
                  latestRunId: "run-approval",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-approval",
                  workspaceId: "workspace-1",
                  taskId: "task-approval",
                  state: "running",
                  title: "Await approval",
                  summary: "Waiting for approval.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                  approval: {
                    status: "pending_decision",
                    approvalId: "approval-1",
                    label: "Approval pending",
                    summary: "Waiting for operator approval.",
                  },
                },
              ],
              reviewPacks: [],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    const triageHeading = await screen.findByRole("heading", { level: 3, name: "Operator triage" });
    const triageSection = triageHeading.closest("section");

    expect(triageSection).toBeTruthy();

    const triageEntry = await within(triageSection as HTMLElement).findByRole("button", {
      name: /Await approval/i,
    });

    expect(triageEntry).toBeTruthy();

    fireEvent.click(triageEntry);

    expect(await screen.findByRole("heading", { level: 1, name: "Missions" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Await approval")).toBeTruthy();
  });

  it("prioritizes blocked review items ahead of lower-severity mission activity in the home triage queue", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-active",
                  workspaceId: "workspace-1",
                  title: "Long compile",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-active",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-active",
                  latestRunId: "run-active",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-active",
                  workspaceId: "workspace-1",
                  taskId: "task-active",
                  state: "running",
                  title: "Long compile",
                  summary: "Still compiling.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                },
              ],
              reviewPacks: [
                {
                  id: "review-failed",
                  runId: "run-active",
                  taskId: "task-active",
                  workspaceId: "workspace-1",
                  summary: "Lint failure",
                  reviewStatus: "ready",
                  evidenceState: "complete",
                  validationOutcome: "failed",
                  warningCount: 0,
                  warnings: [],
                  validations: [],
                  artifacts: [],
                  checksPerformed: [],
                  recommendedNextAction: "Fix the failing lint validation.",
                  createdAt: 0,
                },
              ],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    const triageHeading = await screen.findByRole("heading", {
      level: 3,
      name: "Operator triage",
    });
    const triageSection = triageHeading.closest("section");

    expect(triageSection).toBeTruthy();

    await within(triageSection as HTMLElement).findByRole("button", { name: /Lint failure/i });

    const triageButtons = within(triageSection as HTMLElement).getAllByRole("button");

    expect(triageButtons[0]?.textContent).toContain("Lint failure");
    expect(triageButtons[1]?.textContent).toContain("Long compile");

    fireEvent.click(triageButtons[0] as HTMLElement);

    expect(await screen.findByRole("heading", { level: 1, name: "Review" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Lint failure")).toBeTruthy();
  });

  it("routes the operator-next card into the relevant shared section and focuses the top item", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: "Open missions" });
    fireEvent.click(screen.getByRole("button", { name: "Open missions" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Missions" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "Mission activity" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Launch")).toBeTruthy();
  });

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
  });

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

  it("keeps the shared shell header surface neutral instead of a branded page gradient", () => {
    const shellSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceShell.css.ts"),
      "utf8"
    );
    const shellExport = shellSource.match(/export const shell = style\(\{[\s\S]*?\n\}\);/)?.[0];

    expect(shellExport).toContain('background: "var(--ds-surface-app)"');
    expect(shellExport).not.toContain("radial-gradient(circle at top left");
  });

  it("keeps the shared workspace selector on the system select chrome instead of a bright custom border", () => {
    const shellSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceShell.css.ts"),
      "utf8"
    );
    const selectChromeSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceSelectChrome.css.ts"),
      "utf8"
    );

    expect(selectChromeSource).toMatch(
      /"--ds-select-trigger-open-border":\s*"color-mix\(in srgb, var\(--ds-border-subtle\) 40%, transparent\)"/
    );
    expect(shellSource).toContain('minWidth: "240px"');
    expect(selectChromeSource).toContain('"--ds-select-menu-max-width": "min(420px, 92vw)"');
    expect(selectChromeSource).not.toMatch(/"--ds-select-trigger-open-border":\s*"1px solid/);
  });
});
