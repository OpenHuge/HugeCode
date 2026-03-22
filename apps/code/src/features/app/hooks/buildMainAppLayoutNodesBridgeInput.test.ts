import { describe, expect, it, vi } from "vitest";
import {
  buildComposerResolvedPlacementView,
  buildComposerAutoDriveView,
} from "./layoutBridge/buildMainAppConversationAndComposerBridgeInput";
import { buildMainAppLayoutShellBridgeInput } from "./layoutBridge/buildMainAppLayoutShellBridgeInput";
import { buildMainAppRuntimeAndNotificationsBridgeInput } from "./layoutBridge/buildMainAppRuntimeAndNotificationsBridgeInput";
import {
  normalizeReviewInterventionBackendOptions,
  resolveReviewInterventionFollowUpSelection,
} from "./layoutBridge/useMainAppGitAndReviewBridgeState";

function createAutoDriveState(
  overrides: Partial<Parameters<typeof buildComposerAutoDriveView>[0]["autoDriveState"]> = {}
): Parameters<typeof buildComposerAutoDriveView>[0]["autoDriveState"] {
  return {
    enabled: false,
    draft: {
      enabled: false,
      destination: {
        title: "",
        endState: "",
        doneDefinition: "",
        avoid: "",
        routePreference: "stability_first",
      },
      budget: {
        maxTokens: 6_000,
        maxIterations: 3,
        maxDurationMinutes: 10,
        maxFilesPerIteration: 6,
        maxNoProgressIterations: 2,
        maxValidationFailures: 2,
        maxReroutes: 2,
      },
      riskPolicy: {
        pauseOnDestructiveChange: true,
        pauseOnDependencyChange: true,
        pauseOnLowConfidence: true,
        pauseOnHumanCheckpoint: true,
        allowNetworkAnalysis: false,
        allowValidationCommands: true,
        minimumConfidence: "medium",
      },
    },
    activity: [],
    recovering: false,
    recoverySummary: null,
    run: null,
    setEnabled: vi.fn(),
    setDestinationValue: vi.fn(),
    setBudgetValue: vi.fn(),
    setRiskPolicyValue: vi.fn(),
    preset: {
      active: "safe_default",
      apply: vi.fn(),
    },
    controls: {
      canStart: false,
      canPause: false,
      canResume: false,
      canStop: false,
      busyAction: null,
      onStart: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn(),
      onStop: vi.fn(),
    },
    readiness: {
      readyToLaunch: false,
      issues: [],
      warnings: [],
      checklist: [],
      setupProgress: 0,
    },
    ...overrides,
  };
}

describe("buildComposerAutoDriveView", () => {
  it("keeps the new AutoDrive entry available for the default draft state", () => {
    const autoDrive = buildComposerAutoDriveView({
      source: "runtime_snapshot_v1",
      autoDriveState: createAutoDriveState(),
    });

    expect(autoDrive?.enabled).toBe(false);
    expect(autoDrive?.run).toBeNull();
  });

  it("keeps composer AutoDrive visible once the draft is explicitly enabled", () => {
    const autoDrive = buildComposerAutoDriveView({
      source: "runtime_snapshot_v1",
      autoDriveState: createAutoDriveState({
        enabled: true,
        draft: {
          ...createAutoDriveState().draft,
          enabled: true,
          destination: {
            ...createAutoDriveState().draft.destination,
            title: "Ship the composer cleanup",
          },
        },
      }),
    });

    expect(autoDrive?.enabled).toBe(true);
    expect(autoDrive?.destination.title).toBe("Ship the composer cleanup");
  });
});

describe("buildComposerResolvedPlacementView", () => {
  it("picks the latest placement run for the active workspace and builds warning detail", () => {
    expect(
      buildComposerResolvedPlacementView({
        workspaceId: "workspace-1",
        projection: {
          source: "runtime_snapshot_v1",
          tasks: [],
          runs: [
            {
              id: "run-1",
              workspaceId: "workspace-1",
              taskId: "task-1",
              updatedAt: 10,
              placement: {
                summary: "Fallback backend",
                rationale: "Primary route is saturated",
                healthSummary: "placement_degraded",
              },
              routing: {
                routeLabel: "Fallback route",
              },
            },
            {
              id: "run-2",
              workspaceId: "workspace-1",
              taskId: "task-1",
              updatedAt: 20,
              placement: {
                summary: "Healthy backend",
                rationale: "Primary route recovered",
                healthSummary: "placement_ready",
              },
              routing: {
                routeLabel: "Primary route",
              },
            },
          ],
          reviewPacks: [],
        } as never,
      })
    ).toEqual({
      summary: "Healthy backend",
      detail: "Primary route recovered · Route: Primary route",
      tone: "neutral",
    });
  });
});

describe("buildMainAppLayoutShellBridgeInput", () => {
  it("keeps polling and branch workflow shell wiring stable", () => {
    const onRefreshLocalUsage = vi.fn();
    const onSelectBranchWorkflowSelection = vi.fn();

    const result = buildMainAppLayoutShellBridgeInput({
      state: {
        mainAppHandlers: {} as never,
        appSettings: {} as never,
        workspaceGroupsCount: 2,
        workspacesById: new Map(),
        launchScriptState: {} as never,
        sidebarToggleProps: {} as never,
        activeTab: "missions",
        showPollingFetchStatus: true,
        pollingIntervalMs: 2_500,
        activeGitRoot: "/tmp/repo",
        worktreeApplyLoading: false,
        worktreeApplyError: null,
        worktreeApplySuccess: false,
        threadsState: {} as never,
        workspaces: [],
        groupedWorkspaces: [],
        hasLoadedWorkspaces: true,
        workspaceLoadError: null,
        deletingWorktreeIds: new Set(),
        newAgentDraftWorkspaceId: null,
        startingDraftThreadWorkspaceId: null,
        threadListSortKey: "updated_at",
        activeWorkspaceId: "workspace-1",
        openAppIconById: {},
        activeWorkspace: { id: "workspace-1" } as never,
        onOpenBranchSwitcher: vi.fn(),
        handleBranchSelection: onSelectBranchWorkflowSelection,
        launchScriptsState: {} as never,
        activeAtlasDriverOrder: null,
        activeAtlasEnabled: true,
        activeAtlasDetailLevel: "balanced",
        activeAtlasLongTermMemoryDigest: null,
        fileStatus: "",
        gitRemoteUrl: null,
        gitRootCandidates: [],
        gitRootScanDepth: 2,
        gitRootScanLoading: false,
        gitRootScanError: null,
        gitRootScanHasScanned: false,
        conversationState: {
          homeState: {
            refreshLocalUsage: onRefreshLocalUsage,
          },
          composerState: {
            clearDraftForThread: vi.fn(),
            removeImagesForThread: vi.fn(),
            prefillDraft: null,
            setPrefillDraft: vi.fn(),
            composerInsert: null,
            setComposerInsert: vi.fn(),
          },
        } as never,
        gitPanelState: {
          setGitDiffViewStyle: vi.fn(),
          setCenterMode: vi.fn(),
          setSelectedDiffPath: vi.fn(),
          selectedPullRequest: null,
          setSelectedCommitSha: vi.fn(),
          handleSelectCommit: vi.fn(),
        } as never,
        gitHubPanelState: {
          gitPullRequestComments: [],
        } as never,
        layoutState: {
          rightPanelCollapsed: false,
          isCompact: false,
          isPhone: false,
          handleToggleTerminal: vi.fn(),
        } as never,
      },
      actions: {
        handleSetThreadListSortKey: vi.fn(),
        handleRefreshAllWorkspaceThreads: vi.fn(),
        onOpenSettings: vi.fn(),
        clearDraftState: vi.fn(),
        clearDraftStateIfDifferentWorkspace: vi.fn(),
        selectHome: vi.fn(),
        selectWorkspace: vi.fn(),
        connectWorkspace: vi.fn(),
        setActiveWorkspaceId: vi.fn(),
        setActiveTab: vi.fn(),
        updateWorkspaceSettings: vi.fn(),
        handleRenameThread: vi.fn(),
        removeWorkspace: vi.fn(),
        removeWorktree: vi.fn(),
        exitDiffView: vi.fn(),
        refreshGitStatus: vi.fn(),
        handleCopyThread: vi.fn(),
        onActiveAtlasDriverOrderChange: vi.fn(),
        onActiveAtlasEnabledChange: vi.fn(),
        onActiveAtlasDetailLevelChange: vi.fn(),
        setGitRootScanDepth: vi.fn(),
        scanGitRoots: vi.fn(),
        handlePickGitRoot: vi.fn(),
        handleSetGitRoot: vi.fn(),
        handleApplyWorktreeChanges: vi.fn(),
        handleStageGitAll: vi.fn(),
        handleStageGitFile: vi.fn(),
        handleUnstageGitFile: vi.fn(),
        handleRevertGitFile: vi.fn(),
        handleRevertAllGitChanges: vi.fn(),
      },
    });

    expect(result.showPollingFetchStatus).toBe(true);
    expect(result.pollingIntervalMs).toBe(2_500);
    expect(result.refreshLocalUsage).toBe(onRefreshLocalUsage);
    expect(result.onSelectBranchWorkflowSelection).toBe(onSelectBranchWorkflowSelection);
  });
});

describe("buildMainAppRuntimeAndNotificationsBridgeInput", () => {
  it("keeps runtime-owned debug and terminal wiring inside the runtime domain", () => {
    const onConnectLocalRuntimePort = vi.fn();
    const handleSelectOpenAppId = vi.fn();

    const result = buildMainAppRuntimeAndNotificationsBridgeInput({
      state: {
        activeAccount: null,
        accountSwitchError: null,
        accountCenter: {} as never,
        accountSwitching: false,
        canRefreshCurrentUsage: true,
        canRefreshAllUsage: false,
        currentUsageRefreshLoading: false,
        allUsageRefreshLoading: true,
        errorToasts: [],
        debugState: {
          showDebugButton: true,
          debugEntries: [],
          debugOpen: false,
          clearDebugEntries: vi.fn(),
          handleCopyDebug: vi.fn(),
        } as never,
        layoutState: {
          handleDebugClick: vi.fn(),
          terminalOpen: true,
          onDebugPanelResizeStart: vi.fn(),
          onTerminalPanelResizeStart: vi.fn(),
        } as never,
        updaterController: {
          updaterState: { state: "idle" },
          startUpdate: vi.fn(),
          dismissUpdate: vi.fn(),
          postUpdateNotice: null,
          dismissPostUpdateNotice: vi.fn(),
        } as never,
        terminalControls: {
          terminalTabs: [],
          activeTerminalId: "terminal-1",
          onSelectTerminal: vi.fn(),
          onNewTerminal: vi.fn(),
          onCloseTerminal: vi.fn(),
          terminalState: null,
          canControlActiveTerminal: true,
          handleClearActiveTerminal: vi.fn(),
          handleRestartActiveTerminal: vi.fn(),
          handleInterruptActiveTerminal: vi.fn(),
        },
      },
      actions: {
        handleSwitchAccount: vi.fn(),
        handleSelectLoggedInCodexAccount: vi.fn(),
        handleCancelSwitchAccount: vi.fn(),
        onConnectLocalRuntimePort,
        onRefreshCurrentUsage: vi.fn(),
        onRefreshAllUsage: vi.fn(),
        handleSelectOpenAppId,
        dismissErrorToast: vi.fn(),
      },
    });

    expect(result.onConnectLocalRuntimePort).toBe(onConnectLocalRuntimePort);
    expect(result.onSelectOpenAppId).toBe(handleSelectOpenAppId);
    expect(result.showDebugButton).toBe(true);
    expect(result.terminalOpen).toBe(true);
    expect(result.activeTerminalId).toBe("terminal-1");
    expect(result.canClearTerminal).toBe(true);
  });
});

describe("normalizeReviewInterventionBackendOptions", () => {
  it("keeps only valid backend records and prefers display labels", () => {
    expect(
      normalizeReviewInterventionBackendOptions([
        { backendId: "alpha", displayName: "Alpha Route" },
        { backend_id: "beta", label: "Beta Route" },
        { backendId: "  " },
        null,
      ])
    ).toEqual([
      { value: "alpha", label: "Alpha Route" },
      { value: "beta", label: "Beta Route" },
    ]);
  });
});

describe("resolveReviewInterventionFollowUpSelection", () => {
  it("routes spawned interventions back into review selection by task id", () => {
    expect(
      resolveReviewInterventionFollowUpSelection({
        workspaceId: "workspace-1",
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
        ack: {
          accepted: true,
          action: "retry",
          taskId: "task-1",
          status: "queued",
          outcome: "spawned",
          spawnedTaskId: "task-2",
        },
      })
    ).toEqual({
      workspaceId: "workspace-1",
      taskId: "task-2",
      source: "review_surface",
    });
  });

  it("keeps runtime-managed review targets stable when no spawned task id is returned", () => {
    expect(
      resolveReviewInterventionFollowUpSelection({
        workspaceId: "workspace-1",
        navigationTarget: {
          kind: "review",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          limitation: "thread_unavailable",
        },
        ack: {
          accepted: true,
          action: "continue_with_clarification",
          taskId: "task-1",
          status: "running",
          outcome: "submitted",
          spawnedTaskId: null,
        },
      })
    ).toEqual({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      source: "review_surface",
    });
  });

  it("does not force a review redirect when only a thread target exists", () => {
    expect(
      resolveReviewInterventionFollowUpSelection({
        workspaceId: "workspace-1",
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
        ack: {
          accepted: true,
          action: "retry",
          taskId: "task-1",
          status: "queued",
          outcome: "submitted",
          spawnedTaskId: null,
        },
      })
    ).toBeNull();
  });
});
